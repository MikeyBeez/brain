# Environment Cleanup and Migration Plan

## Current State Analysis

### Problems Identified

1. **Non-functional Knowledge Graph**
   - Location: `/Users/bard/mcp/memory_files/graph.json`
   - Last updated: November 30, 2024
   - Contains generic ARC testing patterns, not project knowledge
   - Not being updated by any system

2. **Broken System Message Instructions**
   - Tells Claude to "use read_graph()" which doesn't actually read anything
   - References "claudepleasereadme.text" which doesn't exist
   - Creates confusion at the start of each session

3. **Fragmented Systems**
   - Cortex_2: Memory/knowledge system
   - Nexus_3: Orchestration system  
   - Various modules that may or may not work
   - No unified way to access information

4. **MCP Configuration Clutter**
   - Multiple MCP servers running
   - Unclear which ones are actually being used
   - No clear documentation of what each does

## Migration Strategy (To Be Executed with Brain Launch)

### Phase 1: Document Current State
```bash
# Create migration directory
mkdir -p /Users/bard/Code/brain/migration

# Backup current configurations
cp /Users/bard/mcp/memory_files/graph.json /Users/bard/Code/brain/migration/old_graph_backup.json
cp /Users/bard/Library/Application\ Support/Claude/claude_desktop_config.json /Users/bard/Code/brain/migration/old_mcp_config.json

# Document what's currently running
echo "Current MCP servers and their purposes" > /Users/bard/Code/brain/migration/CURRENT_STATE.md
```

### Phase 2: Create Working Initialization
- Create `/Users/bard/Code/CLAUDE_INIT.md` with actual, current information
- Update user preferences to reference this file
- Remove broken instructions like `read_graph()`

### Phase 3: Build Brain with Migration in Mind
- Import any useful data from old knowledge graph
- Create migration scripts for any valuable Cortex/Nexus data
- Ensure Brain can replace all current functionality

### Phase 4: Clean Break
When Brain is ready:
1. Update `claude_desktop_config.json` to only include:
   - filesystem
   - brain
   - brave-search  
   - sequential-thinking

2. Remove old MCP servers:
   - cortex
   - nexus

3. Archive old code:
   ```bash
   mkdir -p /Users/bard/Code/_archived
   mv /Users/bard/Code/cortex_2 /Users/bard/Code/_archived/
   mv /Users/bard/Code/nexus_3 /Users/bard/Code/_archived/
   ```

4. Update system message/preferences:
   - Remove all references to old systems
   - Simple instruction: "Run brain:init at start of session"

### Phase 5: Validation
- Test that Brain handles all previous use cases
- Ensure no functionality is lost
- Document any behavior changes

## What Gets Migrated to Brain

### From Knowledge Graph
- Nothing (it's generic ARC patterns, not project-specific)

### From Cortex
- Any useful patterns in how memory is stored/retrieved
- Module loading concepts (simplified)

### From Nexus  
- Task execution patterns
- Command queue concepts (but simplified)

### New in Brain
- Unified storage in SQLite
- Single source of truth
- Immediate feedback on all operations
- Self-documenting via brain:init

## Success Criteria for Cleanup
- [ ] No references to non-existent files in system messages
- [ ] No broken commands in user preferences  
- [ ] Single MCP server (Brain) handles all cognitive functions
- [ ] Clear documentation of what's running and why
- [ ] All old systems properly archived, not deleted

## Timeline
- This cleanup happens AFTER Brain is built and tested
- Not a prerequisite for Brain development
- Estimated: 2-3 weeks after Brain v1.0 is stable

## Notes
- Keep backups of everything before removing
- Test extensively before cutting over
- Have rollback plan ready
- Document all changes for future reference
