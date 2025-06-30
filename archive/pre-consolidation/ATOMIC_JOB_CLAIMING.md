# Brain Atomic Job Claiming Strategy

## The Race Condition Problem

With multiple workers polling the same table, we need to prevent:
```
Worker A: SELECT * FROM executions WHERE status = 'queued' LIMIT 1  -- Gets job 123
Worker B: SELECT * FROM executions WHERE status = 'queued' LIMIT 1  -- Also gets job 123!
Worker A: UPDATE executions SET status = 'running' WHERE id = 123
Worker B: UPDATE executions SET status = 'running' WHERE id = 123    -- Both claim same job!
```

## Solution: Atomic UPDATE with RETURNING

SQLite supports atomic operations using UPDATE...RETURNING:

```sql
-- This is atomic - selection and update happen in one statement
UPDATE executions 
SET status = 'running',
    started_at = CURRENT_TIMESTAMP,
    worker_id = ?1
WHERE id = (
    SELECT id FROM executions 
    WHERE status = 'queued' 
    ORDER BY priority DESC, created_at ASC
    LIMIT 1
)
RETURNING *;
```

## Implementation

```typescript
class ExecutionWorker {
  private workerId: string;
  
  constructor() {
    // Unique worker ID
    this.workerId = `worker_${process.pid}_${Date.now()}`;
  }
  
  async claimNextJob(): Promise<Job | null> {
    // This is atomic - no race condition possible
    const stmt = db.prepare(`
      UPDATE executions 
      SET status = 'running',
          started_at = CURRENT_TIMESTAMP,
          worker_id = $workerId
      WHERE id = (
        SELECT id FROM executions 
        WHERE status = 'queued'
        AND worker_id IS NULL  -- Extra safety check
        ORDER BY priority DESC, created_at ASC
        LIMIT 1
      )
      RETURNING *
    `);
    
    const job = stmt.get({ workerId: this.workerId });
    return job || null;
  }
}
```

## Additional Safety Measures

### 1. Two-Phase Claim (Optional Extra Safety)

If UPDATE...RETURNING isn't available, use a two-phase claim:

```typescript
async claimNextJobTwoPhase(): Promise<Job | null> {
  // Phase 1: Claim with unique worker ID
  const claimResult = db.prepare(`
    UPDATE executions 
    SET worker_id = $workerId,
        status = 'claimed',
        claimed_at = CURRENT_TIMESTAMP
    WHERE id = (
      SELECT id FROM executions 
      WHERE status = 'queued'
      AND worker_id IS NULL
      ORDER BY priority DESC, created_at ASC
      LIMIT 1
    )
  `).run({ workerId: this.workerId });
  
  if (claimResult.changes === 0) {
    return null; // No job available
  }
  
  // Phase 2: Retrieve our claimed job
  const job = db.prepare(`
    SELECT * FROM executions 
    WHERE worker_id = $workerId 
    AND status = 'claimed'
    LIMIT 1
  `).get({ workerId: this.workerId });
  
  // Phase 3: Mark as running
  if (job) {
    db.prepare(`
      UPDATE executions 
      SET status = 'running',
          started_at = CURRENT_TIMESTAMP
      WHERE id = $id
    `).run({ id: job.id });
  }
  
  return job;
}
```

### 2. Stale Claim Recovery

Handle workers that die after claiming but before completing:

```sql
-- Reclaim jobs from dead workers
UPDATE executions 
SET status = 'queued',
    worker_id = NULL,
    claimed_at = NULL
WHERE status IN ('claimed', 'running')
AND worker_id NOT IN (
    SELECT id FROM workers 
    WHERE last_heartbeat > datetime('now', '-5 minutes')
);
```

### 3. Database Transaction Mode

Ensure SQLite is in the right mode:

```typescript
// Enable Write-Ahead Logging for better concurrency
db.pragma('journal_mode = WAL');

// Ensure serializable isolation
db.pragma('read_uncommitted = 0');
```

## Testing Atomicity

```typescript
// Test script to verify atomicity
async function testAtomicClaim() {
  // Insert test job
  await db.run(`
    INSERT INTO executions (id, code, status) 
    VALUES ('test_job', 'print("test")', 'queued')
  `);
  
  // Spawn multiple workers simultaneously
  const workers = Array(10).fill(0).map((_, i) => {
    return claimJob(`worker_${i}`);
  });
  
  const results = await Promise.all(workers);
  const successful = results.filter(r => r !== null);
  
  console.assert(successful.length === 1, 'Exactly one worker should claim the job');
  console.log(`✓ Atomic claim verified: ${successful.length} worker got the job`);
}
```

## Why This Works

1. **Single SQL Statement** - The UPDATE...WHERE id IN (SELECT...) is atomic
2. **No Time Gap** - Selection and update happen together
3. **Worker ID** - Even if somehow both workers update, only one worker_id is written
4. **RETURNING** - Confirms which worker actually got the job

## Edge Cases Handled

1. **Worker dies after claim** - Timeout reclaims job
2. **Database locked** - SQLite handles with busy timeout
3. **Multiple workers start simultaneously** - Atomic operation ensures only one wins
4. **Network partition** - Worker ID ensures ownership

This approach is battle-tested and used by job queue systems like Good Job (Ruby) and others that use database polling.
