# 🧠 Brain - A Unified Cognitive System

## Overview

Brain is a unified cognitive system that merges the functionality of Nexus (orchestration) and Cortex (memory/knowledge) into a single, bulletproof system that works exclusively through MCP tools.

## Problem Statement

Current issues with the Nexus/Cortex separation:
- Two separate systems that are interdependent
- Command queue doesn't provide feedback
- Only MCP tools work reliably from Claude
- Knowledge isn't persistent across sessions
- Too complex and fragmented

## Solution: Unified Brain System

### Core Principles

1. **One Project** - Merge Nexus and Cortex into "Brain"
2. **MCP Only** - Everything through MCP tools with immediate feedback
3. **Bulletproof** - Simple, reliable, no external dependencies
4. **Discoverable** - One command (`brain:init`) tells Claude everything

### Essential MCP Tools

```
brain:init          # Load context, show status, suggest actions
brain:remember      # Store information (replaces both cortex memory and nexus state)
brain:recall        # Retrieve information (with search capabilities)
brain:execute       # Run code with immediate output (replaces queue)
brain:learn         # Update patterns based on usage
brain:status        # Show system health and current state
```

### Architecture

```
/Users/bard/Code/brain/
├── mcp_server/           # Single MCP server
│   ├── index.ts         # Main server
│   ├── tools/           # MCP tool implementations
│   └── brain-mcp.sh     # Launch script
├── data/                # All persistent data
│   ├── brain.db         # SQLite database
│   └── backups/         # Auto-backups
├── README.md            # Human-readable
└── CLAUDE_README.md     # What Claude sees on brain:init
```

### Key Features

1. **Single Source of Truth** - One SQLite database for everything
2. **Immediate Feedback** - Every command returns useful output
3. **Self-Documenting** - brain:init shows Claude everything needed
4. **Context Aware** - Automatically loads relevant information
5. **Pattern Learning** - Improves based on usage

### Implementation Strategy

1. **Phase 1: Foundation**
   - Set up project structure
   - Create MCP server skeleton
   - Implement SQLite storage
   - Basic brain:init functionality

2. **Phase 2: Core Tools**
   - brain:remember - Store any type of information
   - brain:recall - Retrieve with search
   - brain:execute - Run code with feedback
   - brain:status - System health

3. **Phase 3: Intelligence**
   - brain:learn - Pattern recognition
   - Context detection
   - Auto-suggestions
   - Performance optimization

### Design Decisions

1. **Why "Brain"?**
   - Simple, memorable name
   - Intuitive for what it does
   - Easy to type and remember

2. **Why SQLite?**
   - No external dependencies
   - Fast and reliable
   - Easy to backup
   - Supports complex queries

3. **Why TypeScript/Node.js?**
   - MCP SDK is well-supported
   - Type safety
   - Good performance
   - Easy to maintain

### Success Criteria

- Claude can start any session with just `brain:init`
- All operations provide immediate, useful feedback
- System works reliably 100% of the time
- Easy to extend with new capabilities
- Self-healing and self-documenting

### Migration Path

1. Extract useful patterns from Cortex_2 and Nexus_3
2. Simplify and combine into Brain
3. Migrate existing knowledge graph
4. Gradually deprecate old systems

## Next Steps

1. Create project structure
2. Set up MCP server framework
3. Implement brain:init as proof of concept
4. Build out core tools incrementally
5. Test extensively for reliability
