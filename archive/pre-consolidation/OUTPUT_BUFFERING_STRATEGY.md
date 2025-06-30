# Brain Output Buffering Strategy

## The Problem

Streaming output from executing code could generate:
- Thousands of lines per second
- Each line requiring a database write
- SQLite write locks blocking other operations
- Excessive disk I/O

## Solution: Smart Buffering with Periodic Flushes

### Buffering Strategy

```typescript
class OutputBuffer {
  private stdout: string[] = [];
  private stderr: string[] = [];
  private lastFlush: number = Date.now();
  private flushInterval: number = 1000; // 1 second
  private maxBufferSize: number = 10000; // 10KB
  private maxBufferLines: number = 100;  // 100 lines
  
  constructor(
    private executionId: string,
    private db: Database
  ) {}
  
  async appendStdout(data: string) {
    this.stdout.push(data);
    await this.checkFlush();
  }
  
  async appendStderr(data: string) {
    this.stderr.push(data);
    await this.checkFlush();
  }
  
  private async checkFlush() {
    const shouldFlush = 
      // Time-based: every second
      (Date.now() - this.lastFlush > this.flushInterval) ||
      // Size-based: buffer getting large
      (this.getBufferSize() > this.maxBufferSize) ||
      // Line-based: too many lines
      (this.stdout.length + this.stderr.length > this.maxBufferLines);
    
    if (shouldFlush) {
      await this.flush();
    }
  }
  
  async flush() {
    if (this.stdout.length === 0 && this.stderr.length === 0) {
      return;
    }
    
    const stdoutChunk = this.stdout.join('');
    const stderrChunk = this.stderr.join('');
    
    // Append to existing content in database
    await this.db.run(`
      UPDATE executions 
      SET stdout = stdout || $stdout,
          stderr = stderr || $stderr,
          last_output_at = CURRENT_TIMESTAMP
      WHERE id = $id
    `, {
      id: this.executionId,
      stdout: stdoutChunk,
      stderr: stderrChunk
    });
    
    // Clear buffers
    this.stdout = [];
    this.stderr = [];
    this.lastFlush = Date.now();
  }
  
  private getBufferSize(): number {
    return this.stdout.join('').length + this.stderr.join('').length;
  }
}
```

### Progressive Output Storage

For very long outputs, implement progressive storage:

```typescript
class ProgressiveOutputManager {
  private totalStdoutSize = 0;
  private totalStderrSize = 0;
  private readonly maxInlineSize = 1_000_000; // 1MB in main table
  
  async appendOutput(
    executionId: string, 
    stdout: string, 
    stderr: string
  ) {
    this.totalStdoutSize += stdout.length;
    this.totalStderrSize += stderr.length;
    
    if (this.totalStdoutSize < this.maxInlineSize) {
      // Append to main table
      await this.appendToMainTable(executionId, stdout, stderr);
    } else {
      // Overflow to separate table or files
      await this.appendToOverflow(executionId, stdout, stderr);
      await this.updateMainTable(executionId, '[Output truncated - see logs]');
    }
  }
  
  private async appendToOverflow(
    executionId: string,
    stdout: string,
    stderr: string
  ) {
    // Option 1: Separate table
    await db.run(`
      INSERT INTO execution_output_chunks 
      (execution_id, chunk_index, stdout, stderr, timestamp)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `, [executionId, this.getChunkIndex(), stdout, stderr]);
    
    // Option 2: Write to file
    const logFile = `./logs/executions/${executionId}_stdout.log`;
    await fs.appendFile(logFile, stdout);
  }
}
```

### Database Schema Updates

```sql
-- Main executions table stores recent/small outputs
ALTER TABLE executions 
ADD COLUMN stdout_size INTEGER DEFAULT 0;
ADD COLUMN stderr_size INTEGER DEFAULT 0;
ADD COLUMN output_truncated BOOLEAN DEFAULT FALSE;

-- Overflow table for large outputs
CREATE TABLE execution_output_chunks (
    id INTEGER PRIMARY KEY,
    execution_id TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    stdout TEXT,
    stderr TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (execution_id) REFERENCES executions(id)
);

-- Index for efficient retrieval
CREATE INDEX idx_output_chunks_execution 
ON execution_output_chunks(execution_id, chunk_index);
```

### Monitoring Integration

For real-time monitoring, use a hybrid approach:

```typescript
class MonitoringBuffer {
  private recentLines: CircularBuffer<string>;
  
  async updateMonitoring(executionId: string, line: string) {
    // Keep last 100 lines in memory for instant access
    this.recentLines.push(line);
    
    // Update progress field immediately for important messages
    if (this.isProgressMessage(line)) {
      await db.run(`
        UPDATE executions 
        SET progress = $progress 
        WHERE id = $id
      `, { id: executionId, progress: line });
    }
  }
  
  private isProgressMessage(line: string): boolean {
    return line.match(/\d+%|step \d+|complete|error|warning/i);
  }
}
```

### Complete Worker Implementation

```typescript
class ExecutionWorker {
  async processJob(job: Job) {
    const buffer = new OutputBuffer(job.id, this.db);
    const proc = spawn(job.language, ['-c', job.code]);
    
    // Buffer stdout
    proc.stdout.on('data', async (data) => {
      await buffer.appendStdout(data.toString());
    });
    
    // Buffer stderr
    proc.stderr.on('data', async (data) => {
      await buffer.appendStderr(data.toString());
    });
    
    // Ensure final flush on completion
    proc.on('close', async (code) => {
      await buffer.flush();
      await this.completeJob(job.id, code);
    });
    
    // Periodic flush for long-running processes
    const flushTimer = setInterval(() => {
      buffer.flush();
    }, 1000);
    
    proc.on('exit', () => {
      clearInterval(flushTimer);
    });
  }
}
```

## Configuration Options

```typescript
interface BufferConfig {
  flushInterval: number;      // Default: 1000ms
  maxBufferSize: number;      // Default: 10KB
  maxBufferLines: number;     // Default: 100
  maxInlineOutput: number;    // Default: 1MB
  progressPatterns: RegExp[]; // What counts as progress
}

// Environment-based tuning
const config: BufferConfig = {
  flushInterval: process.env.NODE_ENV === 'production' ? 1000 : 100,
  maxBufferSize: 10 * 1024,
  maxBufferLines: 100,
  maxInlineOutput: 1024 * 1024,
  progressPatterns: [/\d+%/, /step \d+/, /complete/i]
};
```

## Benefits

1. **Efficient** - Batches writes instead of one per line
2. **Responsive** - 1-second update interval for monitoring
3. **Scalable** - Handles massive outputs without blocking
4. **Flexible** - Configurable based on needs
5. **Reliable** - No output loss with proper flushing

## Trade-offs

- **Latency**: Up to 1 second delay in output visibility
- **Memory**: Buffers consume memory (limited to 10KB)
- **Complexity**: More code than direct writing

But these are good trade-offs for a production system!
