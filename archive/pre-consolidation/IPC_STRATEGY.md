# Brain Inter-Process Communication Strategy

## The Handoff Challenge

MCP Server needs to hand off execution jobs to the Execution Worker. We need a reliable, simple mechanism that:
- Doesn't lose jobs if worker crashes
- Can handle multiple workers (future scaling)
- Provides visibility for monitoring
- Keeps the MCP server responsive

## Option Analysis

### Option 1: Database Polling (Recommended)

```typescript
// MCP Server
async function handleExecute(args: any) {
  const id = generateUUID();
  await db.insert('executions', {
    id,
    code: args.code,
    status: 'queued',
    created_at: new Date()
  });
  return { execution_id: id, status: 'queued' };
}

// Execution Worker
class ExecutionWorker {
  async run() {
    while (true) {
      // Poll for queued jobs
      const job = await db.getNextQueuedJob();
      if (job) {
        await this.processJob(job);
      } else {
        await sleep(1000); // Poll every second
      }
    }
  }
  
  async getNextQueuedJob() {
    // Atomic claim to prevent race conditions
    const result = await db.run(`
      UPDATE executions 
      SET status = 'claimed', 
          claimed_at = CURRENT_TIMESTAMP,
          worker_id = ?
      WHERE id = (
        SELECT id FROM executions 
        WHERE status = 'queued' 
        ORDER BY created_at 
        LIMIT 1
      )
      RETURNING *
    `, [this.workerId]);
    return result;
  }
}
```

**Pros:**
- ✅ Persistent - Jobs survive crashes
- ✅ Simple - No additional dependencies
- ✅ Observable - Can query job queue
- ✅ Scalable - Multiple workers just poll the same table
- ✅ Reliable - Database handles concurrency

**Cons:**
- ❌ Polling overhead (minimal with 1s interval)
- ❌ Slight delay (up to 1s to pick up job)

### Option 2: Direct IPC (Process Spawn)

```typescript
// MCP Server spawns worker for each job
async function handleExecute(args: any) {
  const id = generateUUID();
  
  // Spawn detached process
  const worker = spawn('node', ['worker.js', id], {
    detached: true,
    stdio: 'ignore'
  });
  worker.unref();
  
  await db.insert('executions', {
    id,
    code: args.code,
    status: 'running',
    pid: worker.pid
  });
  
  return { execution_id: id };
}
```

**Pros:**
- ✅ Immediate execution
- ✅ Direct control over process

**Cons:**
- ❌ Complex process management
- ❌ Harder to limit concurrent executions
- ❌ Lost jobs if spawn fails

### Option 3: Message Queue (Redis/RabbitMQ)

```typescript
// Would require Redis or similar
await redis.lpush('execution_queue', JSON.stringify({
  id, code, language
}));
```

**Pros:**
- ✅ Built for job queues
- ✅ Pub/sub for instant pickup

**Cons:**
- ❌ Additional dependency
- ❌ More complex setup
- ❌ Another service to monitor

### Option 4: File System Queue

```typescript
// Write job files to queue directory
await fs.writeFile(`/queue/${id}.json`, JSON.stringify(job));
```

**Pros:**
- ✅ Simple file-based queue
- ✅ No database polling

**Cons:**
- ❌ File system race conditions
- ❌ Harder to query queue state
- ❌ Cleanup complexity

## Recommended Approach: Smart Database Polling

Use database polling with optimizations:

```typescript
// Hybrid approach - poll with exponential backoff
class SmartExecutionWorker {
  private pollInterval = 100; // Start fast
  private maxInterval = 5000; // Max 5 seconds
  
  async run() {
    while (true) {
      const job = await this.claimNextJob();
      
      if (job) {
        this.pollInterval = 100; // Reset to fast polling
        await this.processJob(job);
      } else {
        await sleep(this.pollInterval);
        // Exponential backoff when idle
        this.pollInterval = Math.min(
          this.pollInterval * 1.5, 
          this.maxInterval
        );
      }
    }
  }
  
  async claimNextJob() {
    // Use RETURNING to get the job atomically
    const result = await db.prepare(`
      UPDATE executions 
      SET status = 'running',
          started_at = CURRENT_TIMESTAMP,
          worker_id = $worker_id
      WHERE id = (
        SELECT id FROM executions 
        WHERE status = 'queued' 
        AND (claimed_at IS NULL OR claimed_at < datetime('now', '-5 minutes'))
        ORDER BY priority DESC, created_at ASC
        LIMIT 1
      )
      RETURNING *
    `).get({ worker_id: this.workerId });
    
    return result;
  }
}
```

## Implementation Details

### 1. Graceful Shutdown
```typescript
process.on('SIGTERM', async () => {
  // Release any claimed but unstarted jobs
  await db.run(`
    UPDATE executions 
    SET status = 'queued', worker_id = NULL 
    WHERE worker_id = ? AND status = 'claimed'
  `, [this.workerId]);
  process.exit(0);
});
```

### 2. Job Priority
```sql
ALTER TABLE executions ADD COLUMN priority INTEGER DEFAULT 5;
-- Higher priority jobs get picked first
```

### 3. Concurrent Execution Limits
```typescript
class ExecutionWorker {
  private activeJobs = new Set();
  private maxConcurrent = 3;
  
  async run() {
    while (true) {
      if (this.activeJobs.size < this.maxConcurrent) {
        const job = await this.claimNextJob();
        if (job) {
          this.executeJob(job); // Don't await
        }
      }
      await sleep(100);
    }
  }
}
```

### 4. Health Monitoring
```typescript
// Worker heartbeat
setInterval(async () => {
  await db.run(`
    UPDATE workers 
    SET last_heartbeat = CURRENT_TIMESTAMP 
    WHERE id = ?
  `, [this.workerId]);
}, 30000);
```

## Why Database Polling Wins

1. **Simplicity** - No additional services or dependencies
2. **Reliability** - SQLite handles all the hard parts
3. **Visibility** - Easy to query queue state
4. **Persistence** - Jobs survive crashes
5. **Flexibility** - Easy to add priority, scheduling, etc.

The slight polling overhead (checking every 100ms-5s) is negligible compared to the benefits of simplicity and reliability.

## Future Enhancements

If we need lower latency later:
1. Add NOTIFY trigger in SQLite
2. Use file system watcher on the database
3. Implement long-polling HTTP endpoint
4. Consider PostgreSQL with LISTEN/NOTIFY

But for v1, simple polling is the right choice.
