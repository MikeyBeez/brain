# Brain Module Architecture

## Overview

Brain uses a modular architecture where functionality is separated into distinct modules orchestrated by a central Brain class. This document defines the module structure, contracts, and stability protocol.

## Core Architecture Principles

1. **Modules are Islands** - No inter-module dependencies
2. **Brain Orchestrates** - Only Brain knows about all modules
3. **Shared via Constructor** - Database and types injected
4. **Synchronous Operations** - Using better-sqlite3 (except ExecutionModule)
5. **Stable Interfaces** - Changes require formal process

**Note on ExecutionModule**: The ExecutionModule is the only exception to the synchronous rule. It doesn't execute code itself but queues jobs for the separate worker process. This ensures the MCP server always responds in <100ms.

## Module Structure

Each module follows this structure:
```
modules/[module-name]/
├── index.ts        # Module implementation
├── schema.sql      # Database schema
├── types.ts        # Module-specific types
└── README.md       # Module documentation
```

## Module Contract

### Every Module MUST:

```typescript
interface BrainModule {
  // Lifecycle
  initialize(): void;      // Set up schema, prepare statements
  validate(): boolean;     // Health check
  cleanup(): void;         // Clean up resources
  
  // Metadata
  getName(): string;       // Module identifier
  getCapabilities(): string[]; // What tools it provides
}
```

### Module Implementation Pattern:

```typescript
import Database from 'better-sqlite3';
import { BrainModule } from '../types';

export class MemoryModule implements BrainModule {
  private statements: {
    set?: Database.Statement;
    get?: Database.Statement;
    search?: Database.Statement;
  } = {};

  constructor(private db: Database.Database) {}

  initialize(): void {
    // Create schema
    this.db.exec(this.getSchema());
    
    // Prepare statements
    this.statements.set = this.db.prepare(
      'INSERT OR REPLACE INTO memories (key, value) VALUES (?, ?)'
    );
    this.statements.get = this.db.prepare(
      'SELECT value FROM memories WHERE key = ?'
    );
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

  // Module-specific methods
  set(key: string, value: any): void {
    this.statements.set!.run(key, JSON.stringify(value));
  }

  get(key: string): any {
    const row = this.statements.get!.get(key) as { value: string } | undefined;
    return row ? JSON.parse(row.value) : null;
  }

  private getSchema(): string {
    return `
      CREATE TABLE IF NOT EXISTS memories (
        key TEXT PRIMARY KEY,
        value JSON NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
  }
}
```

## Module Interfaces

The source of truth for all module interfaces:

```typescript
// modules/types.ts - Changes require formal process

export interface MemoryModuleInterface extends BrainModule {
  set(key: string, value: any): void;
  get(key: string): any;
  search(query: string): SearchResult[];
  delete(key: string): boolean;
}

export interface NotesModuleInterface extends BrainModule {
  create(content: string, title?: string, tags?: string[]): Note;
  get(id: string): Note | null;
  search(query: string, filters?: NoteFilters): Note[];
  update(id: string, updates: Partial<Note>): void;
}

export interface ProjectsModuleInterface extends BrainModule {
  updateIndex(projectPath: string): IndexResult;
  checkIndex(projectPath: string): HealthCheck;
  getDocuments(projectPath: string, category?: string): Document[];
  detectProject(): string | null;
}

export interface ExecutionModuleInterface extends BrainModule {
  queue(code: string, language: string): { executionId: string, status: 'queued' };
  getStatus(executionId: string): ExecutionStatus;
  getOutput(executionId: string): { stdout: string, stderr: string } | null;
  listExecutions(limit?: number): ExecutionSummary[];
}

export interface SessionsModuleInterface extends BrainModule {
  create(): string;
  get(id: string): Session | null;
  update(id: string, data: any): void;
  cleanup(): number; // Returns number of cleaned sessions
}
```

## Shared Resources

### Database Connection
```typescript
// Passed via constructor - modules NEVER create their own
import Database from 'better-sqlite3';

class Brain {
  private db: Database.Database;
  private modules: Record<string, BrainModule>;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    
    // Initialize modules with shared database
    this.modules = {
      memory: new MemoryModule(this.db),
      notes: new NotesModule(this.db),
      projects: new ProjectsModule(this.db),
      execution: new ExecutionModule(this.db),
      sessions: new SessionsModule(this.db)
    };
  }
}
```

### Shared Types
```typescript
// core/types.ts - Only truly shared types
export interface SearchResult {
  score: number;
  content: any;
}

export interface TimestampedRecord {
  created_at: string;
  updated_at?: string;
}

// Module-specific types stay in module directories
```

## Change Protocol

### Non-Breaking Changes (Allowed)
- Adding new methods
- Adding optional parameters
- Adding new tables/columns (with defaults)
- Internal optimizations

### Breaking Changes (Require Process)
1. Create change proposal in `docs/changes/`
2. Provide migration plan
3. Update module version
4. Document in changelog

### Change Proposal Template
```markdown
# Change Proposal: [Module] [Description]
Date: YYYY-MM-DD
Status: Pending

## Current State
[Current interface/behavior]

## Proposed Change
[New interface/behavior]

## Justification
[Why needed]

## Migration Plan
[How to migrate]

## Decision
[ ] Approved [ ] Rejected
```

## Module Loading and Orchestration

```typescript
class Brain {
  initialize(): void {
    // Initialize all modules
    for (const [name, module] of Object.entries(this.modules)) {
      try {
        module.initialize();
        if (!module.validate()) {
          throw new Error(`Module ${name} validation failed`);
        }
      } catch (error) {
        console.error(`Failed to initialize module ${name}:`, error);
        throw error;
      }
    }
  }

  // Orchestration example - spans multiple modules
  initSession(sessionId?: string): Context {
    const session = sessionId 
      ? this.modules.sessions.get(sessionId)
      : this.modules.sessions.create();
      
    const preferences = this.modules.memory.get('user_preferences');
    const project = this.modules.projects.detectProject();
    const recentNotes = this.modules.notes.search('', { 
      days: 7, 
      limit: 10 
    });
    
    return {
      session,
      preferences,
      project,
      recentNotes
    };
  }
}
```

## Best Practices

1. **Keep Modules Focused** - One responsibility per module
2. **No Side Effects** - Return values, don't mutate shared state
3. **Fail Fast** - Validate inputs, throw clear errors
4. **Prepare Statements** - Initialize SQL statements once
5. **Clean Resources** - Implement cleanup method

## Testing Modules

```typescript
import Database from 'better-sqlite3';

describe('MemoryModule', () => {
  let db: Database.Database;
  let module: MemoryModule;
  
  beforeEach(() => {
    db = new Database(':memory:');
    module = new MemoryModule(db);
    module.initialize();
  });
  
  afterEach(() => {
    module.cleanup();
    db.close();
  });
  
  it('should store and retrieve values', () => {
    module.set('test', { value: 123 });
    expect(module.get('test')).toEqual({ value: 123 });
  });
});
```

## Module Lifecycle

```
Brain Startup
     ↓
Create Database Connection
     ↓
Instantiate All Modules
     ↓
Initialize Each Module → Create Schema
     ↓                    Prepare Statements
Validate Each Module
     ↓
Ready for Operations
     ↓
[... normal operation ...]
     ↓
Cleanup Each Module
     ↓
Close Database
```

This architecture ensures modules remain independent while working together through Brain's orchestration.
