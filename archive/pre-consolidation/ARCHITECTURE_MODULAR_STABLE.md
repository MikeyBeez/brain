# Brain Architecture: Modular Design & Stability Protocol

## Overview

Brain uses a modular architecture where functionality is separated into distinct modules that are orchestrated by a central Brain class. This document defines the structure and the protocol for maintaining architectural stability.

## Module Structure

```
brain/
├── src/
│   ├── core/
│   │   ├── database.ts      # Database connection & base operations
│   │   ├── brain.ts         # Central orchestrator
│   │   ├── server.ts        # MCP server setup
│   │   └── types.ts         # Shared types
│   │
│   ├── modules/
│   │   ├── CONTRACT.md      # Module contract (this document)
│   │   ├── types.ts         # Module interfaces (source of truth)
│   │   │
│   │   ├── memory/          # Core memory operations
│   │   │   ├── index.ts     # remember/recall implementation
│   │   │   ├── schema.sql   # Module's database schema
│   │   │   └── README.md    # Module documentation
│   │   │
│   │   ├── notes/           # Note-taking system
│   │   │   ├── index.ts     # note/notes implementation
│   │   │   ├── schema.sql   # Notes tables
│   │   │   └── README.md    
│   │   │
│   │   ├── projects/        # Project index management
│   │   │   ├── index.ts     # index operations
│   │   │   ├── schema.sql   # Central index tables
│   │   │   └── README.md
│   │   │
│   │   ├── execution/       # Code execution
│   │   │   ├── index.ts     # execute implementation
│   │   │   ├── schema.sql   # Execution history
│   │   │   └── README.md
│   │   │
│   │   └── sessions/        # Session management
│   │       ├── index.ts     # Session tracking
│   │       ├── schema.sql   # Session tables
│   │       └── README.md
│   │
│   └── tools/               # MCP tool wrappers
│       ├── init.ts          # brain:init -> sessions + memory
│       ├── remember.ts      # brain:remember -> memory module
│       ├── recall.ts        # brain:recall -> memory module
│       ├── note.ts          # brain:note -> notes module
│       ├── index.ts         # brain:index -> projects module
│       └── execute.ts       # brain:execute -> execution module
```

## Module Contract v1.0

### This Contract is STABLE
- Breaking changes require a formal change proposal
- Additions are always safe
- Modifications need justification and migration plan
- Removal is a breaking change

### Every Module MUST:

1. **Implement the BrainModule interface**
   ```typescript
   interface BrainModule {
     initialize(): Promise<void>;  // Set up schema
     validate(): Promise<boolean>; // Health check
     getCapabilities(): string[];  // What tools it provides
   }
   ```

2. **Own its database schema**
   - Schema defined in `schema.sql`
   - Module creates its own tables
   - Module manages its own migrations

3. **Provide pure functions**
   - No side effects beyond its own data
   - Return values, don't mutate shared state
   - Throw errors, don't log directly

4. **Never import from other modules**
   - No `import { something } from '../memory'`
   - All inter-module communication through Brain
   - Modules are islands

5. **Document its public interface**
   - Every public method documented
   - Examples in module README
   - Types in module's index.ts

### Every Module MAY:
1. Add new methods (non-breaking)
2. Add new schema columns (with defaults)
3. Add internal optimizations
4. Add optional parameters to existing methods
5. Create sub-modules internally

## The Architecture Pyramid

```
┌─────────────────────┐
│   MCP Tools         │ <- Changes rarely (user-facing)
├─────────────────────┤
│ Brain Orchestrator  │ <- Changes occasionally 
├─────────────────────┤
│ Module Interfaces   │ <- STABLE (the contract)
├─────────────────────┤
│ Module Internals    │ <- Changes freely
└─────────────────────┘
```

## Module Interface Definitions

```typescript
// modules/types.ts - THE source of truth for all module interfaces
// Changing this file requires following the Change Protocol

export interface MemoryModuleInterface {
  set(key: string, value: any): Promise<void>;
  get(key: string): Promise<any>;
  search(query: string): Promise<SearchResult[]>;
  delete(key: string): Promise<boolean>;
}

export interface NotesModuleInterface {
  create(content: string, title?: string, tags?: string[]): Promise<Note>;
  get(id: string): Promise<Note>;
  search(query: string, filters?: NoteFilters): Promise<Note[]>;
  update(id: string, updates: Partial<Note>): Promise<void>;
}

export interface ProjectsModuleInterface {
  updateIndex(projectPath: string): Promise<IndexResult>;
  checkIndex(projectPath: string): Promise<HealthCheck>;
  getDocuments(projectPath: string, category?: string): Promise<Document[]>;
  detectProject(): Promise<string | null>;
}

export interface ExecutionModuleInterface {
  execute(code: string, language: string): Promise<ExecutionResult>;
  getHistory(limit?: number): Promise<Execution[]>;
  getExecution(id: string): Promise<Execution>;
}

export interface SessionsModuleInterface {
  init(sessionId: string): Promise<Context>;
  get(sessionId: string): Promise<Session>;
  update(sessionId: string, updates: Partial<Session>): Promise<void>;
  cleanup(): Promise<number>;
}
```

## Change Protocol

### For Non-Breaking Changes (Additions)
1. Add the new functionality
2. Update module documentation
3. Add tests
4. No special process required

### For Breaking Changes

1. **Create Change Proposal**
   ```markdown
   # Change Proposal: [Module] [Change Description]
   
   ## Current State
   - Current interface signature
   - Current behavior
   
   ## Proposed Change
   - New interface signature
   - New behavior
   
   ## Justification
   - Why is this change necessary?
   - What problems does it solve?
   
   ## Impact Analysis
   - What breaks?
   - Which tools are affected?
   - Which modules are affected?
   
   ## Migration Plan
   - Step-by-step migration
   - Backward compatibility approach
   - Timeline
   
   ## Decision
   - [ ] Approved
   - [ ] Rejected
   - [ ] Needs revision
   ```

2. **File in** `docs/changes/YYYY-MM-DD-module-change.md`

3. **Update Version**
   - Module interfaces are versioned
   - Breaking change = major version bump

4. **Provide Migration**
   - Migration guide in `docs/migrations/`
   - Automated migration if possible

## Brain Orchestrator

The Brain class is the only component that knows about all modules:

```typescript
// src/core/brain.ts
export class Brain {
  private modules: {
    memory: MemoryModule;
    notes: NotesModule;
    projects: ProjectsModule;
    execution: ExecutionModule;
    sessions: SessionsModule;
  };
  
  constructor(private db: Database) {
    // Initialize all modules with the database
    this.modules = {
      memory: new MemoryModule(db),
      notes: new NotesModule(db),
      projects: new ProjectsModule(db),
      execution: new ExecutionModule(db),
      sessions: new SessionsModule(db)
    };
  }
  
  async initialize() {
    // Initialize all modules
    for (const module of Object.values(this.modules)) {
      await module.initialize();
    }
  }
  
  // Brain provides unified operations that may use multiple modules
  async init(sessionId: string): Promise<Context> {
    // Orchestrate across modules
    const session = await this.modules.sessions.init(sessionId);
    const preferences = await this.modules.memory.get('user_preferences');
    const currentProject = await this.modules.projects.detectProject();
    
    if (currentProject) {
      const projectDocs = await this.modules.projects.getDocuments(currentProject);
      session.projectContext = projectDocs;
    }
    
    return session;
  }
}
```

## Key Principles

1. **Stability Through Structure** - Interfaces are contracts
2. **Growth Through Addition** - New features = new methods or modules
3. **Change Through Process** - Breaking changes require ceremony
4. **Isolation Through Modules** - Changes don't cascade
5. **Unity Through Orchestration** - Brain provides coherence

## Enforcement

1. **Code Review** - Changes to `modules/types.ts` require extra scrutiny
2. **Tests** - Module interface tests ensure contracts are maintained
3. **Documentation** - Changes must be documented
4. **Versioning** - Semantic versioning for module interfaces

This architecture ensures Brain can grow without becoming brittle, and changes are deliberate rather than accidental.
