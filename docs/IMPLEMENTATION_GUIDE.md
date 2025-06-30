# Brain Implementation Guide

## Overview

This guide provides practical instructions for implementing Brain, following our core principles of simplicity, reliability, and no unnecessary abstractions.

## Core Principles

1. **YAGNI (You Aren't Gonna Need It)** - No abstractions until needed twice
2. **Commit to Decisions** - When we decide, we commit fully
3. **Direct Implementation** - No layers of indirection
4. **Synchronous Operations** - Using better-sqlite3, no async wrappers in MCP server
5. **Delete, Don't Comment** - Trust Git to remember alternatives

**Note**: The execution worker is the only part of the system that uses async/await, as it needs to handle process spawning and file I/O. All database operations remain synchronous even in the worker.

## Getting Started

### Prerequisites
- Node.js 18+
- TypeScript 5+
- SQLite3 installed on system

### Initial Setup
```bash
cd /Users/bard/Code/brain
npm init -y
npm install --save \
  @modelcontextprotocol/sdk \
  better-sqlite3 \
  typescript \
  @types/better-sqlite3 \
  @types/node

npm install --save-dev \
  @types/jest \
  jest \
  ts-jest \
  ts-node
```

### TypeScript Configuration
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

## Implementation Order

### Phase 1: Core Infrastructure (Week 1)
1. Database connection (`core/database.ts`)
2. Basic MCP server (`core/server.ts`)
3. Memory module (`modules/memory/`)
4. Session module (`modules/sessions/`)
5. Tools: init, status, remember, recall

### Phase 2: Extended Features (Week 2)
1. Execution module (`modules/execution/`) - queue only
2. Execution worker (`src/worker/`) - separate process
3. Notes module (`modules/notes/`)
4. Projects module (`modules/projects/`)
5. Tools: execute, note, index

### Phase 3: Intelligence (Week 3)
1. Pattern learning
2. Context inference
3. Performance optimization

## Code Examples

### Database Connection (Shared)
```typescript
// core/database.ts
import Database from 'better-sqlite3';

export function createDatabase(dbPath: string): Database.Database {
  const db = new Database(dbPath);
  
  // Enable WAL mode for better concurrency
  db.pragma('journal_mode = WAL');
  
  // Foreign keys
  db.pragma('foreign_keys = ON');
  
  return db;
}
```

### MCP Server Setup
```typescript
// core/server.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createDatabase } from './database.js';
import { Brain } from './brain.js';

const DB_PATH = process.env.BRAIN_DB_PATH || './data/brain.db';

async function main() {
  const db = createDatabase(DB_PATH);
  const brain = new Brain(db);
  
  // Initialize all modules
  brain.initialize();
  
  const server = new Server(
    {
      name: 'brain',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Register tools
  server.setRequestHandler('tools/list', async () => ({
    tools: [
      {
        name: 'brain:init',
        description: 'Initialize Brain session',
        inputSchema: {
          type: 'object',
          properties: {
            session_id: { type: 'string' }
          }
        }
      },
      // ... other tools
    ],
  }));

  server.setRequestHandler('tools/call', async (request) => {
    const { name, arguments: args } = request.params;
    
    switch (name) {
      case 'brain:init':
        return brain.tools.init(args);
      case 'brain:remember':
        return brain.tools.remember(args);
      // ... other tools
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
```

### Module Implementation
```typescript
// modules/memory/index.ts
import Database from 'better-sqlite3';
import { BrainModule } from '../types';

export class MemoryModule implements BrainModule {
  private statements: {
    set?: Database.Statement;
    get?: Database.Statement;
  } = {};

  constructor(private db: Database.Database) {}

  initialize(): void {
    // Create schema
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        key TEXT PRIMARY KEY,
        value JSON NOT NULL,
        type TEXT DEFAULT 'general',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        access_count INTEGER DEFAULT 0
      );
      
      CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(type);
      CREATE INDEX IF NOT EXISTS idx_memories_accessed ON memories(accessed_at);
    `);

    // Prepare statements
    this.statements.set = this.db.prepare(`
      INSERT OR REPLACE INTO memories (key, value, type)
      VALUES (?, ?, ?)
    `);
    
    this.statements.get = this.db.prepare(`
      UPDATE memories 
      SET accessed_at = CURRENT_TIMESTAMP,
          access_count = access_count + 1
      WHERE key = ?
      RETURNING value
    `);
  }

  validate(): boolean {
    try {
      this.db.prepare('SELECT 1 FROM memories LIMIT 1').get();
      return true;
    } catch {
      return false;
    }
  }

  cleanup(): void {
    // Statements are cleaned up automatically
  }

  getName(): string {
    return 'memory';
  }

  getCapabilities(): string[] {
    return ['remember', 'recall'];
  }

  set(key: string, value: any, type: string = 'general'): void {
    this.statements.set!.run(key, JSON.stringify(value), type);
  }

  get(key: string): any {
    const row = this.statements.get!.get(key) as { value: string } | undefined;
    return row ? JSON.parse(row.value) : null;
  }

  // ... other methods
}
```

### Tool Implementation
```typescript
// tools/remember.ts
import { Brain } from '../core/brain.js';

export function createRememberTool(brain: Brain) {
  return {
    name: 'brain:remember',
    description: 'Store information in Brain',
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string' },
        value: {},
        type: { type: 'string' }
      },
      required: ['key', 'value']
    },
    execute: async function* (args: any) {
      const { key, value, type } = args;
      
      yield {
        type: 'text',
        text: `Storing '${key}'...`
      };
      
      try {
        brain.modules.memory.set(key, value, type);
        
        yield {
          type: 'text',
          text: `✓ Stored successfully`
        };
        
        const stats = brain.modules.memory.getStats();
        yield {
          type: 'text',
          text: `This is memory #${stats.total}`
        };
      } catch (error) {
        yield {
          type: 'text',
          text: `✗ Error: ${error.message}`
        };
      }
    }
  };
}
```

## Testing

### Unit Tests
```typescript
// modules/memory/memory.test.ts
import Database from 'better-sqlite3';
import { MemoryModule } from './index';

describe('MemoryModule', () => {
  let db: Database.Database;
  let memory: MemoryModule;

  beforeEach(() => {
    db = new Database(':memory:');
    memory = new MemoryModule(db);
    memory.initialize();
  });

  afterEach(() => {
    db.close();
  });

  test('stores and retrieves values', () => {
    memory.set('test-key', { data: 'test-value' });
    const result = memory.get('test-key');
    expect(result).toEqual({ data: 'test-value' });
  });

  test('returns null for missing keys', () => {
    const result = memory.get('missing');
    expect(result).toBeNull();
  });
});
```

### Integration Tests
```typescript
// Run actual MCP server and test tools
import { spawn } from 'child_process';

test('brain:init creates session', async () => {
  const server = spawn('npm', ['run', 'start']);
  
  // Send MCP request
  const response = await sendMCPRequest('brain:init', {});
  
  expect(response.session_id).toBeDefined();
  expect(response.status).toBe('new');
  
  server.kill();
});
```

### Execution Worker Implementation
```typescript
// src/worker/index.ts
import Database from 'better-sqlite3';
import { createDatabase } from '../core/database';
import { spawn } from 'child_process';
import * as fs from 'fs/promises';

const POLL_INTERVAL = 1000; // 1 second

function claimJob(db: Database.Database): any {
  const job = db.prepare(`
    UPDATE executions 
    SET status = 'running', 
        started_at = CURRENT_TIMESTAMP,
        worker_id = ?
    WHERE id = (
      SELECT id FROM executions 
      WHERE status = 'queued' 
      ORDER BY created_at ASC 
      LIMIT 1
    )
    RETURNING *
  `).get(process.pid);
  
  return job;
}

async function executeCode(db: Database.Database, job: any): Promise<void> {
  const outputPath = `./data/executions/${job.id}.out`;
  const errorPath = `./data/executions/${job.id}.err`;
  
  const child = spawn('python', ['-c', job.code]);
  
  const output = await fs.open(outputPath, 'w');
  const error = await fs.open(errorPath, 'w');
  
  child.stdout.pipe(output.createWriteStream());
  child.stderr.pipe(error.createWriteStream());
  
  return new Promise((resolve) => {
    child.on('exit', (code) => {
      db.prepare(`
        UPDATE executions 
        SET status = ?, 
            completed_at = CURRENT_TIMESTAMP,
            exit_code = ?,
            output_file = ?,
            error_file = ?
        WHERE id = ?
      `).run(
        code === 0 ? 'completed' : 'failed',
        code,
        outputPath,
        errorPath,
        job.id
      );
      resolve();
    });
  });
}

async function worker() {
  const db = createDatabase('./data/brain.db');
  
  console.log('Brain worker started, polling for jobs...');
  
  while (true) {
    try {
      const job = claimJob(db);
      if (job) {
        console.log(`Executing job ${job.id}`);
        await executeCode(db, job);
        console.log(`Job ${job.id} completed`);
      }
    } catch (error) {
      console.error('Worker error:', error);
    }
    
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
  }
}

// Start the worker
if (require.main === module) {
  worker().catch(console.error);
}
```

## Deployment

### Launch Scripts

#### MCP Server
```bash
#!/bin/bash
# scripts/start.sh

# Ensure data directory exists
mkdir -p data

# Set environment
export NODE_ENV=production
export BRAIN_DB_PATH="./data/brain.db"

# Start server
exec node dist/core/server.js
```

#### Execution Worker
```bash
#!/bin/bash
# scripts/start-worker.sh

# Ensure directories exist
mkdir -p data/executions

# Set environment
export NODE_ENV=production
export BRAIN_DB_PATH="./data/brain.db"

# Start worker
exec node dist/worker/index.js
```

### Claude Configuration
```json
{
  "brain": {
    "command": "/Users/bard/Code/brain/scripts/start.sh",
    "args": [],
    "env": {}
  }
}
```

## Error Handling

### Consistent Error Pattern
```typescript
try {
  // Operation
  const result = doSomething();
  yield { type: 'text', text: `Success: ${result}` };
} catch (error) {
  yield { type: 'text', text: `⚠️ Error: ${error.message}` };
  
  // Log for debugging
  console.error(`[${new Date().toISOString()}] Error in ${toolName}:`, error);
  
  // Don't throw - return error message
}
```

## Performance Considerations

1. **Prepared Statements** - Initialize once, reuse many times
2. **Indexes** - Add indexes for frequently queried columns
3. **Batch Operations** - Use transactions for multiple operations
4. **Memory Limits** - Respect 300-item context window limit
5. **Connection Pooling** - Not needed with SQLite

## Common Pitfalls to Avoid

1. **Don't use async/await with better-sqlite3** - It's synchronous
2. **Don't create abstractions** - Direct implementation only
3. **Don't leave commented code** - Delete it
4. **Don't over-engineer** - Start simple
5. **Don't ignore errors** - Handle them gracefully

## Next Steps

1. Set up the project structure
2. Implement database connection
3. Create first module (memory)
4. Add first tool (remember)
5. Test with Claude
6. Iterate and expand

Remember: Build the simplest thing that works. We can always refactor when we have real requirements, not imagined ones.
