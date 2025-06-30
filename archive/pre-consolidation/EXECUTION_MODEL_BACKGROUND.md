# Brain Execution Model - Background Processing with Monitoring

## Revised Execution Approach

Instead of streaming output through MCP tools, Brain will:
1. **Queue executions** in the background
2. **Return execution ID** immediately
3. **Allow monitoring** through a separate interface (Monitex or logs)

## Execution Flow

```
Claude → brain:execute → Queue Task → Return ID → Monitor Separately
                              ↓
                        Background Process
                              ↓
                        Logs/Database/Monitor
```

## Revised brain:execute Tool

### Input
```typescript
{
  code: string,
  language?: string,
  timeout?: number,
  description?: string
}
```

### Output (Immediate)
```typescript
{
  execution_id: string,
  status: 'queued',
  message: 'Execution queued. Check monitor for output.',
  monitor_url: 'http://localhost:8888/executions/{id}'
}
```

## Database Schema Addition

```sql
-- Update executions table to support monitoring
ALTER TABLE executions ADD COLUMN stdout TEXT;
ALTER TABLE executions ADD COLUMN stderr TEXT;
ALTER TABLE executions ADD COLUMN progress TEXT;
ALTER TABLE executions ADD COLUMN last_output_at TIMESTAMP;
```

## Background Execution Worker

```typescript
// Separate process that runs executions
class ExecutionWorker {
  async processExecution(id: string) {
    const execution = await db.getExecution(id);
    
    // Update status
    await db.updateExecution(id, { 
      status: 'running', 
      started_at: new Date() 
    });
    
    // Spawn process
    const proc = spawn(execution.language, ['-c', execution.code]);
    
    // Capture output to database
    proc.stdout.on('data', async (data) => {
      await db.appendOutput(id, 'stdout', data.toString());
    });
    
    proc.stderr.on('data', async (data) => {
      await db.appendOutput(id, 'stderr', data.toString());
    });
    
    proc.on('close', async (code) => {
      await db.updateExecution(id, {
        status: 'completed',
        exit_code: code,
        completed_at: new Date()
      });
    });
  }
}
```

## Monitoring Options

### 1. Via brain:status Tool
```typescript
// Check specific execution
brain:status execution_id

// Returns:
{
  execution: {
    id: 'exec_123',
    status: 'running',
    started: '2 minutes ago',
    last_output: 'Processing file 3 of 10...'
  }
}
```

### 2. Via Monitex Dashboard
```
http://localhost:9999/brain

Shows:
- Active executions
- Recent completions
- Live output (polling database)
- Resource usage
```

### 3. Via Log Files
```
/Users/bard/Code/brain/logs/executions/
├── exec_123_stdout.log
├── exec_123_stderr.log
└── exec_123_meta.json
```

## Benefits of This Approach

1. **Non-blocking** - Claude gets immediate response
2. **Monitorable** - Can watch progress in real-time via UI
3. **Persistent** - Output saved for later review
4. **Scalable** - Can run multiple executions in parallel
5. **Debuggable** - Full logs available

## Example Interaction

```
Claude: brain:execute { code: "for i in range(10): print(i); time.sleep(1)" }

Brain: {
  execution_id: "exec_abc123",
  status: "queued",
  message: "Execution queued. Monitor at http://localhost:8888/executions/exec_abc123"
}

Claude: brain:status { execution_id: "exec_abc123" }

Brain: {
  execution: {
    id: "exec_abc123",
    status: "running",
    progress: "60% complete",
    last_output: "6",
    elapsed_seconds: 6
  }
}

[Meanwhile in Monitex, user sees live output streaming]
```

## Simple Monitoring Endpoint

```typescript
// Minimal HTTP endpoint for Monitex
app.get('/executions/:id', async (req, res) => {
  const execution = await db.getExecution(req.params.id);
  res.json({
    ...execution,
    stdout: execution.stdout || '',
    stderr: execution.stderr || '',
    can_stream: execution.status === 'running'
  });
});

// Server-sent events for live streaming
app.get('/executions/:id/stream', async (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  
  // Poll database and send updates
  const interval = setInterval(async () => {
    const output = await db.getNewOutput(req.params.id, lastPosition);
    if (output) {
      res.write(`data: ${JSON.stringify(output)}\n\n`);
    }
  }, 1000);
});
```

This approach gives you the best of both worlds:
- Fast, non-blocking MCP responses
- Rich monitoring capabilities
- Persistent execution history
- Scalable background processing
