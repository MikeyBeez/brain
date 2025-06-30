# Brain - Endpoint Integration Strategy

## Current System Endpoints

### Monitex Dashboard
- **Port**: 9999
- **Purpose**: Unified monitoring interface
- **Status**: Keep as-is for monitoring Brain

### Cortex_2 Endpoints (Port 8000)
```
GET  /health
GET  /modules
POST /modules/{id}/load
POST /modules/{id}/unload
POST /context/push
POST /context/analyze
GET  /memory
POST /memory/optimize
WS   /ws/modules
```

### Nexus_3 Endpoints (Port 8100)
```
GET    /health
POST   /tasks
GET    /tasks/{id}
GET    /tasks?status=...
GET    /queue/stats
DELETE /tasks/{id}
POST   /orchestrate
GET    /modules
WS     /ws/tasks/{id}
WS     /ws/queue
```

### Anna_2 Endpoints (Ports 9001-9005, Control: 9888)
```
GET  /status (control center)
POST /process (control center)
WS   /ws/stream (control center)
GET  /{organ}/health (each organ)
GET  /{organ}/state (each organ)
POST /{organ}/modulate (each organ)
GET  /temporal/phase
POST /temporal/sync
GET  /temporal/metrics
GET  /hormones
POST /hormones/evaluate
WS   /ws/temporal
```

## Brain Integration Strategy

### Option 1: Unified API (Recommended)

Create Brain as a **unified gateway** that:
1. Exposes its own MCP-first interface
2. Optionally provides HTTP endpoints for Monitex
3. Internally manages what was Cortex/Nexus functionality

```
Brain API (Port 8000):
GET  /health              # Combined health of all subsystems
POST /remember            # Store information (replaces Cortex memory)
POST /recall              # Retrieve information with search
POST /execute             # Run tasks (replaces Nexus tasks)
GET  /status              # Current state and suggestions
POST /learn               # Update patterns
WS   /ws/updates          # Real-time updates
```

### Option 2: Preserve Existing Endpoints

Keep Cortex/Nexus endpoints but run them from Brain:
- Brain becomes the single service
- Maintains backward compatibility
- Monitex continues working unchanged

### Option 3: Gradual Migration

1. **Phase 1**: Brain provides new unified endpoints
2. **Phase 2**: Proxy old endpoints to new implementation
3. **Phase 3**: Deprecate old endpoints
4. **Phase 4**: Remove deprecated endpoints

## Recommended Approach: Unified API with Compatibility Layer

### Core Brain Endpoints

```python
# MCP Tools (primary interface)
brain:init        → Initialize session
brain:remember    → Store any information
brain:recall      → Retrieve with search
brain:execute     → Run code/commands
brain:status      → System health & suggestions
brain:learn       → Capture patterns

# HTTP API (for Monitex and debugging)
GET  /api/v1/health
POST /api/v1/memory
GET  /api/v1/memory?search=...
POST /api/v1/execute
GET  /api/v1/status
```

### Compatibility Endpoints

To keep Monitex working initially:

```python
# Cortex compatibility
GET  /cortex/health      → brain.health()
GET  /cortex/modules     → brain.list_capabilities()
POST /cortex/context     → brain.set_context()

# Nexus compatibility  
GET  /nexus/health       → brain.health()
POST /nexus/tasks        → brain.execute()
GET  /nexus/tasks/{id}   → brain.get_execution()
```

## Database Schema for Unified System

```sql
-- Core storage
CREATE TABLE memories (
    id INTEGER PRIMARY KEY,
    key TEXT UNIQUE,
    value JSON,
    type TEXT,
    tags TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    access_count INTEGER DEFAULT 0,
    session_id TEXT
);

-- Execution history (replaces Nexus tasks)
CREATE TABLE executions (
    id TEXT PRIMARY KEY,  -- UUID
    command TEXT,
    status TEXT,  -- pending, running, completed, failed
    result JSON,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    session_id TEXT
);

-- Learning patterns
CREATE TABLE patterns (
    id INTEGER PRIMARY KEY,
    pattern_type TEXT,  -- command, query, sequence
    pattern_data JSON,
    frequency INTEGER DEFAULT 1,
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    confidence REAL DEFAULT 0.5
);

-- Session tracking
CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_context JSON,
    action_count INTEGER DEFAULT 0
);

-- Full-text search
CREATE VIRTUAL TABLE memories_fts USING fts5(
    key, value, tags,
    content=memories
);
```

## Monitoring Integration

### For Monitex Dashboard

1. **Minimal Change Approach**:
   - Brain exposes `/health` endpoint combining all status
   - Monitex only needs to query one endpoint
   - Shows unified Brain status instead of separate systems

2. **Enhanced Approach**:
   - Create new Monitex tab for Brain
   - Show session info, memory stats, execution queue
   - Real-time updates via WebSocket

### Example Health Endpoint Response

```json
{
  "status": "healthy",
  "version": "1.0.0",
  "session": {
    "id": "chat_abc123",
    "active": true,
    "duration_minutes": 15
  },
  "memory": {
    "total_items": 156,
    "recent_accesses": 23,
    "size_mb": 12.5
  },
  "execution": {
    "total": 45,
    "recent": 5,
    "average_time_ms": 125
  },
  "subsystems": {
    "storage": "healthy",
    "mcp_server": "healthy",
    "pattern_engine": "healthy"
  }
}
```

## Benefits of Unified Approach

1. **Simplicity**: One service, one database, one API
2. **Reliability**: Fewer moving parts
3. **Performance**: No inter-service communication
4. **Maintainability**: Single codebase
5. **Discoverability**: Brain is the only thing to remember

## Migration Path

1. Build Brain with new unified API
2. Add compatibility endpoints for Monitex
3. Test with existing dashboard
4. Gradually migrate Monitex to use Brain API
5. Remove compatibility layer once stable

## Decision

Recommend **Unified API with Compatibility Layer**:
- Clean, simple design for Brain
- Monitex continues working
- Gradual migration possible
- Single source of truth
- MCP-first with HTTP for monitoring
