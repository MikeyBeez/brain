# Brain Architecture: MCP + Internal API Design

## Current Understanding

The Nexus MCP server acts as a bridge:
```
Claude → MCP Tool → HTTP Request → Nexus API → Response → Claude
```

## Options for Brain

### Option 1: Direct MCP Implementation (No HTTP API)
```
Claude → MCP Tool → Direct SQLite Operations → Response → Claude
```

**Pros:**
- Simpler, fewer moving parts
- No HTTP overhead
- Everything in one process
- Faster response times

**Cons:**
- All logic in MCP server
- Harder to test/debug
- No way to monitor via Monitex

### Option 2: MCP + Internal API (Like Nexus)
```
Claude → MCP Tool → HTTP Request → Brain API → SQLite → Response → Claude
```

**Pros:**
- Separation of concerns
- API can be monitored by Monitex
- Easier to test API separately
- Could expose API for other uses

**Cons:**
- More complex
- HTTP overhead
- Need to run two processes

### Option 3: Hybrid Approach (Recommended)
```
Claude → MCP Tool → Internal Module → SQLite → Response → Claude
                           ↓
                    Optional HTTP API for monitoring
```

**Structure:**
```
brain/
├── mcp_server/
│   ├── src/
│   │   ├── index.ts          # MCP server entry
│   │   ├── tools/            # MCP tool handlers
│   │   │   ├── init.ts       # brain:init tool
│   │   │   ├── status.ts     # brain:status tool
│   │   │   ├── remember.ts   # brain:remember tool
│   │   │   ├── recall.ts     # brain:recall tool
│   │   │   └── execute.ts    # brain:execute tool
│   │   └── core/             # Shared business logic
│   │       ├── database.ts   # SQLite operations
│   │       ├── memory.ts     # Memory management
│   │       ├── session.ts    # Session management
│   │       └── execution.ts  # Code execution
│   └── package.json
├── api_server/               # Optional HTTP API
│   ├── src/
│   │   ├── server.ts        # Express/Fastify server
│   │   └── routes/
│   │       └── health.ts    # /health endpoint for Monitex
│   └── package.json
└── shared/                  # Shared types and utilities
    ├── types.ts
    └── config.ts
```

## Modular Code Organization

### MCP Tool Module Example
```typescript
// mcp_server/src/tools/remember.ts
import { Database } from '../core/database';
import { validateInput } from '../core/validation';

export async function handleRemember(args: any) {
  // Validate input
  const { key, value, tags } = validateInput(args);
  
  // Store in database
  const db = Database.getInstance();
  await db.remember(key, value, tags);
  
  // Return response
  return {
    content: [{
      type: 'text',
      text: `Remembered "${key}" with ${tags.length} tags`
    }]
  };
}
```

### Core Module Example
```typescript
// mcp_server/src/core/database.ts
import Database from 'better-sqlite3';
import { Memory, Session } from '../../shared/types';

export class Database {
  private static instance: Database;
  private db: Database.Database;
  
  static getInstance(): Database {
    if (!this.instance) {
      this.instance = new Database();
    }
    return this.instance;
  }
  
  async remember(key: string, value: any, tags: string[]) {
    // Implementation
  }
  
  async recall(query: string) {
    // Implementation
  }
}
```

## Benefits of Modular Approach

1. **Small Files**: Each tool in its own file (~50-100 lines)
2. **Fast Editing**: Find and edit specific functionality quickly
3. **Easy Testing**: Test individual modules in isolation
4. **Shared Logic**: Core modules used by both MCP and API
5. **Clear Structure**: Easy to understand and navigate

## Recommendation

Use the **Hybrid Approach** with modular organization:

1. **Primary**: MCP tools directly use core modules (no HTTP)
2. **Optional**: Minimal HTTP API just for health monitoring
3. **Modular**: Each tool and core function in separate files
4. **Shared**: Business logic in core modules used by both

This gives us:
- Fast MCP responses (no HTTP overhead)
- Monitex compatibility (health endpoint)
- Clean, modular code
- Easy to maintain and extend
