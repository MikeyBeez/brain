# Brain Development Summary

## Decisions Made

### 1. Storage: SQLite with JSON Columns
- **Why**: Reliable, supports queries, ACID compliant, proven at scale
- **Structure**: Hybrid approach with structured columns + JSON flexibility
- **Full-text search**: Using FTS5 for powerful search capabilities

### 2. Architecture: Unified System
- **Merge**: Cortex (memory) + Nexus (execution) = Brain
- **Single service**: One MCP server, one database, one API
- **Session management**: Track initialization per chat, avoid duplicates

### 3. Discovery: System Message Integration
- **Auto-init**: Claude runs `brain:status` then `brain:init` if needed
- **Once per chat**: Session tracking prevents duplicate initialization
- **Bulletproof**: Always available, always works

### 4. Endpoints: Unified API with Compatibility
- **Primary**: MCP tools (brain:init, brain:remember, etc.)
- **Secondary**: HTTP API for Monitex monitoring
- **Compatibility**: Optional layer for existing Cortex/Nexus endpoints
- **Monitex**: Can continue using existing dashboard with minimal changes

### 5. Core MCP Tools
```
brain:init       # Initialize session, load context
brain:status     # Check if initialized, show health
brain:remember   # Store any information
brain:recall     # Retrieve with search
brain:execute    # Run code with feedback
brain:learn      # Capture patterns
```

## Key Design Principles

1. **MCP First**: Everything through MCP tools
2. **Immediate Feedback**: Every command returns useful output
3. **Self-Documenting**: brain:init tells Claude everything
4. **Bulletproof**: SQLite for reliability, simple architecture
5. **Discoverable**: One command to start (brain:init)

## Database Schema (Core Tables)

```sql
memories          # Key-value storage with JSON content
executions        # Command execution history  
patterns          # Learned patterns and usage
sessions          # Active session tracking
memories_fts      # Full-text search index
```

## Next Steps

1. [ ] Create basic project structure
2. [ ] Set up TypeScript MCP server skeleton
3. [ ] Implement SQLite database layer
4. [ ] Build brain:init and brain:status tools
5. [ ] Add brain:remember and brain:recall
6. [ ] Implement brain:execute with feedback
7. [ ] Add compatibility endpoints for Monitex
8. [ ] Test end-to-end functionality
9. [ ] Create migration scripts from existing systems
10. [ ] Update system message documentation

## Success Criteria

- Claude can run `brain:init` in any session
- All operations provide immediate feedback
- System works 100% of the time
- Monitex can monitor Brain health
- Easy to extend with new capabilities

## Questions Resolved

- ✅ Storage: SQLite with JSON columns
- ✅ Architecture: Unified system
- ✅ Discovery: System message + brain:init
- ✅ Endpoints: Unified with compatibility layer
- ✅ Session management: In-memory with SQLite backup

## Open Questions

- How to handle very large stored values (e.g., file contents)?
- How to implement pattern learning effectively?
- How to package and deploy the MCP server?
- How to handle Brain updates without losing data?

This represents our current plan for Brain - a unified, reliable, discoverable cognitive system for Claude.
