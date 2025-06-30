# Brain Project Inconsistency Resolution

## Overview

This document resolves all identified inconsistencies in the Brain project documentation. Each resolution includes the decision and rationale.

## Resolutions

### 1. Execution Worker Async/Sync Clarification

**Decision**: The execution worker uses async/await ONLY for file I/O and process spawning. All database operations remain synchronous throughout the entire system.

**Clarification**:
- MCP Server: 100% synchronous
- Execution Worker: 
  - Database operations: Synchronous (better-sqlite3)
  - File I/O: Asynchronous (fs/promises)
  - Process spawning: Asynchronous (child_process)

**Updated text for IMPLEMENTATION_GUIDE.md**:
```
Note: The execution worker uses async/await ONLY for file I/O and process spawning. 
All database operations remain synchronous throughout the entire system, including 
in the worker. This ensures consistent database handling while allowing the worker 
to handle long-running processes efficiently.
```

### 2. Module Types Location

**Decision**: Module interfaces go in `modules/types.ts` as the single source of truth. Individual modules do NOT have their own types.ts files.

**Rationale**: Having types in one place prevents drift and makes it easier to see all contracts at once.

**Updated module structure**:
```
modules/
├── types.ts         # ALL module interfaces and shared types
├── memory/          
│   ├── index.ts     # Implementation only
│   └── schema.sql   
├── notes/           
│   ├── index.ts     # Implementation only
│   └── schema.sql   
└── ...
```

### 3. Tool Response Format

**Decision**: All tools use async generator functions that yield streaming responses.

**Rationale**: This allows for progressive updates and better user experience.

**Standard tool format**:
```typescript
interface ToolResponse {
  type: 'text';
  text: string;
}

interface Tool {
  name: string;
  description: string;
  inputSchema: object;
  execute: (args: any) => AsyncGenerator<ToolResponse>;
}
```

**Updated SPEC.md tool definitions** should show the streaming format:
```typescript
// brain:remember
async function* execute(args) {
  yield { type: 'text', text: 'Storing memory...' };
  // perform operation
  yield { type: 'text', text: '✓ Memory stored successfully' };
}

// brain:execute  
async function* execute(args) {
  const { execution_id } = brain.modules.execution.queue(args.code, args.language);
  yield { type: 'text', text: `✓ Code queued for execution: ${execution_id}` };
}
```

### 4. Project Structure

**Decision**: Use the detailed structure from SPEC.md as the canonical reference. README.md shows a simplified view for quick reference.

**Clarification**: No README.md files in individual module directories (keep it simple).

### 5. Memory Module Interface

**Decision**: Memory module does NOT have a delete method. Keep it simple with just set/get/search.

**Rationale**: YAGNI principle - add delete only if/when needed.

**Final MemoryModule interface**:
```typescript
interface MemoryModuleInterface extends BrainModule {
  set(key: string, value: any, type?: string): void;
  get(key: string): any;
  search(query: string, limit?: number): SearchResult[];
}
```

### 6. Sessions Module Interface

**Decision**: Sessions module includes the update method.

**Rationale**: Sessions need to be updated as the conversation progresses.

**Final SessionsModule interface**:
```typescript
interface SessionsModuleInterface extends BrainModule {
  create(): string;
  get(id: string): Session | null;
  update(id: string, data: any): void;
  cleanup(): number; // Returns number of cleaned sessions
}
```

### 7. Error Handling in Tools

**Decision**: Tools should NEVER throw errors. Always catch and yield error messages.

**Standard error handling pattern**:
```typescript
async function* execute(args: any) {
  try {
    // Attempt operation
    const result = someOperation();
    yield { type: 'text', text: `✓ Success: ${result}` };
  } catch (error) {
    // Never throw - always yield error message
    yield { type: 'text', text: `⚠️ Error: ${error.message}` };
    
    // Log for debugging (don't expose full stack to user)
    console.error(`[${new Date().toISOString()}] ${toolName} error:`, error);
  }
}
```

### 8. Knowledge Graph Reference

**Decision**: The Brain system does NOT have a `read_graph()` function. This was part of the old Cortex/Nexus system.

**For Mikey Bee**: 
- Use `brain:init` to initialize sessions and load context
- Use `brain:recall` to search for stored information
- The Brain system will automatically load relevant context based on your preferences and recent activity

**Updated user preference handling**:
When you start a session, Brain will:
1. Load your user preferences (always)
2. Detect active project context
3. Load recent memories (last 7 days)
4. Provide intelligent suggestions

## Implementation Checklist

To implement these resolutions:

1. ✓ Update SPEC.md to show streaming tool responses
2. ✓ Update MODULE_ARCHITECTURE.md to remove individual types.ts files
3. ✓ Clarify async/sync in IMPLEMENTATION_GUIDE.md
4. ✓ Standardize module interfaces in modules/types.ts
5. ✓ Document error handling pattern clearly
6. ✓ Remove any references to old Cortex/Nexus functions

## Summary

These resolutions create a consistent, clear specification:
- **Streaming tools** for better UX
- **Centralized types** for easier maintenance  
- **Clear async boundaries** (worker file/process ops only)
- **Consistent error handling** (never throw in tools)
- **Simple module structure** (no extra files)

The Brain system is now ready for implementation with all inconsistencies resolved.
