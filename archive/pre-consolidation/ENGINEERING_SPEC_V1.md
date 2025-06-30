# Brain Engineering Specification v1.0

## Project Overview

Brain is a unified cognitive system for Claude that provides persistent memory, code execution, and learning capabilities through MCP (Model Context Protocol) tools. It replaces the fragmented Cortex/Nexus architecture with a single, reliable service.

## Core Requirements

### Functional Requirements
1. **Session Management** - Track initialization per chat session
2. **Memory Storage** - Store and retrieve any type of information
3. **Code Execution** - Run code with streaming output
4. **Pattern Learning** - Learn from usage patterns
5. **Context Awareness** - Maintain user preferences and project context

### Non-Functional Requirements
1. **Reliability** - 100% uptime, no data loss
2. **Performance** - <100ms response time for most operations
3. **Feedback** - Immediate, streaming responses
4. **Simplicity** - Minimal dependencies, easy to maintain
5. **Discoverability** - Claude can always find and use Brain

## Architecture

### Technology Stack
- **Language**: TypeScript (Node.js)
- **Database**: SQLite with JSON columns
- **MCP SDK**: @modelcontextprotocol/sdk
- **Testing**: Jest
- **Build**: esbuild

### Project Structure
```
brain/
├── mcp_server/
│   ├── src/
│   │   ├── index.ts              # MCP server entry point
│   │   ├── tools/                # MCP tool implementations
│   │   │   ├── init.ts          # brain:init
│   │   │   ├── status.ts        # brain:status  
│   │   │   ├── remember.ts      # brain:remember
│   │   │   ├── recall.ts        # brain:recall
│   │   │   ├── execute.ts       # brain:execute
│   │   │   └── learn.ts         # brain:learn
│   │   ├── core/                 # Business logic
│   │   │   ├── database.ts      # Database operations
│   │   │   ├── session.ts       # Session management
│   │   │   ├── memory.ts        # Memory operations
│   │   │   ├── execution.ts     # Code execution
│   │   │   └── patterns.ts      # Pattern learning
│   │   └── utils/                # Utilities
│   │       ├── logger.ts        # Logging
│   │       └── config.ts        # Configuration
│   ├── tests/                    # Test files
│   ├── package.json
│   └── tsconfig.json
├── data/
│   ├── brain.db                  # SQLite database
│   └── backups/                  # Automatic backups
├── scripts/
│   ├── install.sh               # Installation script
│   └── migrate.sh               # Migration from Cortex/Nexus
└── docs/
    ├── API.md                   # MCP tool documentation
    └── CLAUDE_README.md         # Loaded by brain:init
```

## Database Schema

```sql
-- Core memory storage with tiered loading support
CREATE TABLE memories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    value JSON NOT NULL,
    type TEXT DEFAULT 'general',
    tags TEXT, -- comma-separated
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    access_count INTEGER DEFAULT 0,
    session_id TEXT,
    storage_tier TEXT DEFAULT 'warm', -- hot/warm/cold
    metadata JSON, -- size_estimate, load_priority, etc
    UNIQUE(key)
);

-- Full-text search
CREATE VIRTUAL TABLE memories_fts USING fts5(
    key, value, tags,
    content=memories
);

-- Code execution history
CREATE TABLE executions (
    id TEXT PRIMARY KEY, -- UUID
    code TEXT NOT NULL,
    language TEXT DEFAULT 'python',
    status TEXT NOT NULL, -- pending, running, completed, failed
    output TEXT,
    error TEXT,
    exit_code INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    session_id TEXT
);

-- Session tracking
CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_preferences JSON,
    context JSON,
    action_count INTEGER DEFAULT 0,
    active BOOLEAN DEFAULT TRUE
);

-- Pattern learning
CREATE TABLE patterns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pattern_type TEXT NOT NULL, -- command, query, sequence
    pattern_data JSON NOT NULL,
    frequency INTEGER DEFAULT 1,
    confidence REAL DEFAULT 0.5,
    first_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_memories_type ON memories(type);
CREATE INDEX idx_memories_session ON memories(session_id);
CREATE INDEX idx_memories_accessed ON memories(accessed_at);
CREATE INDEX idx_executions_status ON executions(status);
CREATE INDEX idx_executions_session ON executions(session_id);
CREATE INDEX idx_patterns_type ON patterns(pattern_type);
CREATE INDEX idx_patterns_last_seen ON patterns(last_seen);
```

## MCP Tools Specification

### brain:init
Initialize or resume a session with intelligent memory loading (max 300 items).

**Input:**
```typescript
{
  session_id?: string  // Optional, for resuming
}
```

**Output:**
```typescript
{
  session_id: string,
  status: 'new' | 'resumed',
  user: string,
  preferences: object,
  recent_activity: Array<{action: string, timestamp: string}>,
  suggestions: string[],
  loaded_memories: number,  // How many loaded into context
  total_memories: number,   // Total in database
  message: string
}
```

**Behavior:**
1. Check if session exists
2. Create new or resume existing
3. Load ONLY critical memories (max 300):
   - User preferences (always)
   - Active project context
   - Recent commands/patterns
   - Frequently accessed items
4. Show recent activity
5. Suggest next actions
6. Indicate more memories available via brain:recall

### brain:status
Check system and session status.

**Input:**
```typescript
{
  session_id?: string
}
```

**Output:**
```typescript
{
  status: 'active' | 'not_initialized',
  session?: {
    id: string,
    duration_minutes: number,
    action_count: number
  },
  system: {
    memory_items: number,
    db_size_mb: number,
    uptime_minutes: number
  }
}
```

### brain:remember
Store information persistently.

**Input:**
```typescript
{
  key: string,
  value: any,
  type?: string,
  tags?: string[]
}
```

**Output (streaming):**
```typescript
"Storing '{key}'..."
"✓ Stored successfully"
"Added tags: {tags}"
"This is your {nth} memory"
```

### brain:recall
Retrieve information with search.

**Input:**
```typescript
{
  query: string,
  type?: string,
  tags?: string[],
  limit?: number
}
```

**Output (streaming):**
```typescript
"Searching for '{query}'..."
"Found {n} matches:"
"[1] {key}: {preview}"
"[2] {key}: {preview}"
...
```

### brain:execute
Execute code with streaming output.

**Input:**
```typescript
{
  code: string,
  language?: string  // default: python
}
```

**Output (streaming):**
```typescript
"🚀 Executing {language} code..."
"{stdout line 1}"
"{stdout line 2}"
"Error: {stderr}"
"✅ Execution complete (exit code: {code})"
```

### brain:learn
Capture patterns for learning.

**Input:**
```typescript
{
  pattern_type: 'command' | 'query' | 'sequence',
  data: any
}
```

**Output:**
```typescript
"Pattern recorded"
"Confidence: {confidence}%"
"Similar patterns: {count}"
```

## Implementation Guidelines

### Code Style
- Use async generators for streaming responses
- Keep functions small (<50 lines)
- One responsibility per module
- Comprehensive error handling
- TypeScript strict mode

### Error Handling
```typescript
try {
  // operation
} catch (error) {
  yield { type: 'text', text: `⚠️ Error: ${error.message}` };
  yield { type: 'text', text: 'Attempting recovery...' };
  // recovery logic
}
```

### Logging
- Use structured logging
- Log all operations with session context
- Rotate logs daily
- Keep 7 days of logs

### Testing
- Unit tests for all core functions
- Integration tests for MCP tools
- Mock database for tests
- >80% code coverage

## Security Considerations

1. **Input Validation** - Sanitize all inputs
2. **Code Execution** - Sandbox environment
3. **Memory Limits** - Prevent DoS
4. **SQL Injection** - Use prepared statements
5. **Session Security** - Expire old sessions

## Memory Constraints

### Context Window Limitation
- **Maximum Context**: ~300 nodes/memories can be loaded at once
- **Intelligent Loading**: Load only essential items on init
- **Tiered Storage**: Hot (loaded), Warm (available), Cold (archived)
- **On-Demand Loading**: Fetch additional memories as needed

### Loading Strategy
1. **User Preferences**: Always load (~10 items)
2. **Active Projects**: Current work context (~20 items)
3. **Recent Activity**: Last 7 days (~50 items)
4. **Frequent Items**: Access count > 10 (~50 items)
5. **Summaries**: Compressed knowledge (~50 items)
6. **Buffer**: Leave space for session data (~120 items)

## Performance Requirements

- **Startup Time**: <2 seconds
- **Memory Usage**: <100MB baseline
- **Response Time**: <100ms for queries
- **Database Size**: Support up to 1GB
- **Concurrent Sessions**: Handle 10+
- **Context Loading**: <300 items on init

## Deployment

### Installation
```bash
cd /Users/bard/Code/brain
npm install
npm run build
```

### Configuration
```bash
# Add to claude_desktop_config.json
"brain": {
  "command": "/Users/bard/Code/brain/mcp_server/brain-mcp.sh",
  "args": [],
  "env": {}
}
```

### Health Monitoring
- Optional HTTP endpoint on port 8888
- Returns combined system status
- Compatible with Monitex

## Migration Plan

1. Export data from Cortex/Nexus
2. Transform to Brain schema
3. Import into SQLite
4. Update Claude configuration
5. Test all operations
6. Deprecate old systems

## Success Metrics

1. **Reliability**: Zero data loss
2. **Performance**: All operations <100ms
3. **Usability**: One command to start
4. **Adoption**: Replace Cortex/Nexus completely
5. **Extensibility**: Easy to add new tools

## Future Enhancements

1. **Vector embeddings** for semantic search
2. **Compression** for old memories
3. **Sync** across devices
4. **Plugins** for extensibility
5. **Analytics** dashboard

## Version History

- v1.0 - Initial specification (2024-01-27)

---

This specification provides the foundation for building Brain as a unified, reliable cognitive system for Claude.
