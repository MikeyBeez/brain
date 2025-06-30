# Brain System Specification

## Overview

Brain is a unified cognitive system that provides persistent memory, code execution, and learning capabilities for Claude through MCP (Model Context Protocol) tools. It replaces the fragmented Cortex/Nexus architecture with a single, reliable service.

## Core Principles

1. **One System** - Unified Brain replacing Cortex/Nexus
2. **MCP Only** - All interaction through MCP tools
3. **Bulletproof** - SQLite for reliability, simple architecture
4. **Discoverable** - One command (`brain:init`) starts everything
5. **Modular** - Clear module boundaries with stable interfaces

## Architecture

### Technology Stack
- **Language**: TypeScript (Node.js)
- **Database**: SQLite with better-sqlite3 (synchronous)
- **Protocol**: MCP tools only
- **Full-text Search**: SQLite FTS5
- **No abstractions** until needed twice (YAGNI principle)

### Project Structure
```
brain/
├── src/
│   ├── core/
│   │   ├── brain.ts         # Central orchestrator
│   │   ├── database.ts      # Shared database connection
│   │   ├── server.ts        # MCP server setup
│   │   └── types.ts         # Shared types only
│   │
│   ├── modules/
│   │   ├── types.ts         # Module interfaces (THE contract)
│   │   ├── memory/          # Core memory operations
│   │   │   ├── index.ts     
│   │   │   └── schema.sql   
│   │   ├── notes/           # Note-taking system
│   │   │   ├── index.ts     
│   │   │   └── schema.sql   
│   │   ├── projects/        # Project index management
│   │   │   ├── index.ts     
│   │   │   └── schema.sql   
│   │   ├── execution/       # Code execution scheduling
│   │   │   ├── index.ts     
│   │   │   └── schema.sql   
│   │   └── sessions/        # Session management
│   │       ├── index.ts     
│   │       └── schema.sql   
│   │
│   ├── tools/               # MCP tool implementations
│   │   ├── init.ts          # brain:init
│   │   ├── status.ts        # brain:status
│   │   ├── remember.ts      # brain:remember
│   │   ├── recall.ts        # brain:recall
│   │   ├── execute.ts       # brain:execute
│   │   ├── learn.ts         # brain:learn
│   │   ├── note.ts          # brain:note
│   │   └── index.ts         # brain:index
│   │
│   └── worker/              # Execution worker (separate process)
│       ├── index.ts         # Worker entry point
│       ├── executor.ts      # Python execution logic
│       └── monitor.ts       # Execution monitoring
│
├── data/                    # Runtime data (gitignored)
│   ├── brain.db            # SQLite database
│   ├── executions/         # Execution logs and outputs
│   └── backups/            # Auto-backups
│
├── notes/                   # Project notes (dual storage)
├── scripts/
│   ├── start.sh            # Launch MCP server
│   └── start-worker.sh     # Launch execution worker
├── package.json
├── tsconfig.json
└── README.md
```

## MCP Tools

### Core Tools (Always Available)

#### brain:init
Initialize or resume a session.
```typescript
Input: { session_id?: string }
Output: {
  session_id: string,
  status: 'new' | 'resumed',
  user: string,
  context: object,
  loaded_memories: number,  // Max 300
  suggestions: string[]
}
```

#### brain:status
Check system, session, and execution status.
```typescript
Input: { session_id?: string, execution_id?: string }
Output: {
  status: 'active' | 'not_initialized',
  session?: object,
  system?: object,
  execution?: object
}
```

#### brain:remember
Store information persistently.
```typescript
Input: { key: string, value: any, type?: string }
Output: Stream of status messages
```

#### brain:recall
Retrieve information with search.
```typescript
Input: { query: string, limit?: number }
Output: Stream of search results
```

#### brain:execute
Queue code for execution by the worker process.
```typescript
Input: { code: string, language?: string }
Output: { execution_id: string, status: 'queued' }
```

#### brain:learn
Capture patterns for learning.
```typescript
Input: { pattern_type: string, data: any }
Output: Confirmation message
```

### Extended Tools

#### brain:note
Quick note capture with dual storage.
```typescript
Input: { content: string, title?: string, tags?: string[] }
Output: { success: boolean, locations: object }
```

#### brain:index
Manage project documentation index.
```typescript
Input: { operation: 'update' | 'check' | 'get', category?: string }
Output: { success: boolean, results: any }
```

## Database Schema

### Core Tables

```sql
-- Memory storage with intelligent loading
CREATE TABLE memories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    value JSON NOT NULL,
    type TEXT DEFAULT 'general',
    tags TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    access_count INTEGER DEFAULT 0,
    storage_tier TEXT DEFAULT 'warm', -- hot/warm/cold
    metadata JSON
);

CREATE VIRTUAL TABLE memories_fts USING fts5(
    key, value, tags,
    content=memories
);

-- Session tracking (ephemeral, in-memory primary)
CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    data JSON
);

-- Code execution queue and history
CREATE TABLE executions (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    language TEXT DEFAULT 'python',
    status TEXT NOT NULL, -- queued, running, completed, failed
    output_file TEXT,     -- Path to output log
    error_file TEXT,      -- Path to error log
    exit_code INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    worker_id TEXT        -- Which worker claimed this
);

-- Pattern learning
CREATE TABLE patterns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pattern_type TEXT NOT NULL,
    pattern_data JSON NOT NULL,
    frequency INTEGER DEFAULT 1,
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Module-Specific Tables

```sql
-- Notes (from notes module)
CREATE TABLE notes (
    id TEXT PRIMARY KEY,
    project TEXT,
    content TEXT NOT NULL,
    title TEXT,
    tags TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    file_path TEXT,
    sync_status TEXT DEFAULT 'synced'
);

CREATE VIRTUAL TABLE notes_fts USING fts5(
    content, title,
    content=notes
);

-- Project index (from projects module)
CREATE TABLE central_index (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project TEXT NOT NULL,
    path TEXT NOT NULL,
    purpose TEXT,
    category TEXT,
    size INTEGER,
    last_modified DATETIME,
    last_seen DATETIME,
    status TEXT DEFAULT 'active',
    UNIQUE(project, path)
);
```

## Module Architecture

### Module Contract
Every module MUST:
1. Implement the BrainModule interface
2. Own its database schema
3. Never import from other modules
4. Use only the shared database connection
5. Provide synchronous operations (better-sqlite3)

### Module Interfaces
```typescript
// modules/types.ts - THE source of truth
interface BrainModule {
  initialize(): void;
  validate(): boolean;
  cleanup(): void;
  getName(): string;
  getCapabilities(): string[];
}

// Common types used across modules
interface SearchResult {
  key: string;
  value: any;
  score: number;
}

interface Note {
  id: string;
  content: string;
  title?: string;
  tags?: string[];
  created_at: string;
  file_path?: string;
}

interface ExecutionStatus {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  created_at: string;
  started_at?: string;
  completed_at?: string;
  exit_code?: number;
}

interface ExecutionSummary {
  id: string;
  status: string;
  created_at: string;
  language: string;
}

interface Session {
  id: string;
  started_at: Date;
  last_accessed: Date;
  data: any;
}

interface IndexResult {
  success: boolean;
  files_indexed: number;
  files_orphaned: number;
}

interface Document {
  path: string;
  category: string;
  purpose: string;
  last_modified: string;
}

interface HealthCheck {
  healthy: boolean;
  issues: {
    orphaned: string[];
    missing: string[];
    stale: string[];
  };
}

interface NoteFilters {
  days?: number;
  tags?: string[];
  project?: string;
  limit?: number;
}

// Module interfaces
interface MemoryModule extends BrainModule {
  set(key: string, value: any): void;
  get(key: string): any;
  search(query: string): SearchResult[];
}

interface NotesModule extends BrainModule {
  create(content: string, title?: string, tags?: string[]): Note;
  search(query: string): Note[];
}

interface ProjectsModule extends BrainModule {
  updateIndex(projectPath: string): IndexResult;
  getDocuments(projectPath: string, category?: string): Document[];
}

interface ExecutionModule extends BrainModule {
  queue(code: string, language: string): { executionId: string, status: 'queued' };
  getStatus(executionId: string): ExecutionStatus;
  getOutput(executionId: string): { stdout: string, stderr: string } | null;
  listExecutions(limit?: number): ExecutionSummary[];
}

interface SessionsModule extends BrainModule {
  create(): string;
  get(id: string): Session | null;
  cleanup(): void;
}
```

### Shared Resources
Modules share ONLY through constructor injection:
```typescript
import Database from 'better-sqlite3';

class MemoryModule {
  constructor(private db: Database.Database) {}
  // No imports from other modules
}
```

## Session Management

Sessions are **ephemeral** (in-memory) with SQLite backup:
- Primary storage: In-memory Map for fast access
- Backup: SQLite for recovery after restart
- Lifecycle: 24-hour expiration
- No persistence requirements between restarts

## Memory Management

### Context Window Constraint
- Maximum 300 items loaded on `brain:init`
- Intelligent loading based on:
  - User preferences (always loaded)
  - Active project context
  - Recent activity (last 7 days)
  - Frequently accessed items

### Storage Tiers
1. **Hot**: Loaded on init (max 300 items)
2. **Warm**: Available via search
3. **Cold**: Archived, rarely accessed

## Implementation Guidelines

### Two-Process Architecture

Brain uses a two-process architecture to handle the inherent conflict between synchronous operations and long-running code execution:

1. **MCP Server Process** (always responsive)
   - Handles all MCP tool calls
   - All operations complete in <100ms
   - Uses synchronous database operations
   - For `brain:execute`, only queues the job

2. **Execution Worker Process** (handles long-running tasks)
   - Polls the executions table for 'queued' jobs
   - Claims jobs atomically to prevent duplication
   - Runs Python code in isolated environment
   - Writes output to log files
   - Updates execution status in database

### Database Operations
All database operations are **synchronous** using better-sqlite3:
```typescript
// Correct - synchronous
const result = db.prepare('SELECT * FROM memories WHERE key = ?').get(key);

// Incorrect - no async/await
const result = await db.get(key); // Don't do this
```

### Error Handling
```typescript
try {
  // operation
} catch (error) {
  yield { type: 'text', text: `⚠️ Error: ${error.message}` };
  // recovery logic
}
```

### No Abstractions
Follow YAGNI principle:
- No StorageProvider interfaces
- No command patterns
- No plugin systems
- Direct implementation only

## System Message Integration

Add to Claude's system message:
```
At the start of each conversation, run brain:init to load context.
```

Brain handles session management automatically.

## Success Criteria

1. Claude can start any session with just `brain:init`
2. All operations complete in <100ms
3. System works reliably 100% of the time
4. Respects 300-item context limit
5. Easy to extend with new modules

## Migration Path

1. Build core modules first (memory, sessions)
2. Add extended modules (notes, projects)
3. Import useful patterns from Cortex/Nexus
4. Gradually deprecate old systems

---

This specification consolidates all previous documents and resolves all contradictions.
