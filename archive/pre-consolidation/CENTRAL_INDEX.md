# 🧠 Brain - Unified Cognitive System

## Overview

Brain is a unified cognitive system that replaces the fragmented Nexus/Cortex architecture with a single, bulletproof MCP-based system that provides persistent memory, code execution, and pattern learning for Claude.

## Project Status: 📋 Planning Phase

Currently finalizing specifications and preparing for implementation.

## 📚 Documentation Index

### Core Documents
- **[BRAIN_PROPOSAL.md](BRAIN_PROPOSAL.md)** - Original vision and problem statement
- **[DEVELOPMENT_SUMMARY.md](DEVELOPMENT_SUMMARY.md)** - Current decisions and next steps
- **[CODING_GUIDELINES.md](CODING_GUIDELINES.md)** - How we write code (commit to decisions!)

### Architecture & Design
- **[ARCHITECTURE_MODULAR_STABLE.md](ARCHITECTURE_MODULAR_STABLE.md)** - Modular design & stability protocol ⭐
- **[ENGINEERING_SPEC_V1.md](ENGINEERING_SPEC_V1.md)** - Technical specification
- **[ARCHITECTURE_MCP_MODULAR.md](ARCHITECTURE_MCP_MODULAR.md)** - MCP architecture details
- **[STORAGE_OPTIONS_ANALYSIS.md](STORAGE_OPTIONS_ANALYSIS.md)** - Why we chose SQLite
- **[SESSION_MANAGEMENT_SPEC.md](SESSION_MANAGEMENT_SPEC.md)** - How sessions work

### Implementation Strategy
- **[WHY_DIRECT_MCP.md](WHY_DIRECT_MCP.md)** - Why MCP tools only
- **[TOOL_KNOWLEDGE.md](TOOL_KNOWLEDGE.md)** - Tool implementation details
- **[INDEX_TOOL_SPEC.md](INDEX_TOOL_SPEC.md)** - Central index management tool
- **[NOTE_TOOL_SPEC.md](NOTE_TOOL_SPEC.md)** - Note capture with dual storage
- **[MEMORY_MANAGEMENT_STRATEGY.md](MEMORY_MANAGEMENT_STRATEGY.md)** - Memory approach
- **[EXECUTION_MODEL_BACKGROUND.md](EXECUTION_MODEL_BACKGROUND.md)** - Code execution design

### Integration & Deployment
- **[DISCOVERABILITY.md](DISCOVERABILITY.md)** - How Claude finds Brain
- **[SYSTEM_MESSAGE_INTEGRATION.md](SYSTEM_MESSAGE_INTEGRATION.md)** - System message setup
- **[BOOT_PROCESS_DESIGN.md](BOOT_PROCESS_DESIGN.md)** - Knowledge graph boot process
- **[ENDPOINT_INTEGRATION_STRATEGY.md](ENDPOINT_INTEGRATION_STRATEGY.md)** - API endpoints
- **[CLEANUP_MIGRATION_PLAN.md](CLEANUP_MIGRATION_PLAN.md)** - Migration from old systems

### Technical Details
- **[IPC_STRATEGY.md](IPC_STRATEGY.md)** - Inter-process communication
- **[OUTPUT_BUFFERING_STRATEGY.md](OUTPUT_BUFFERING_STRATEGY.md)** - Output handling
- **[ATOMIC_JOB_CLAIMING.md](ATOMIC_JOB_CLAIMING.md)** - Job execution atomicity
- **[CONTEXT_ASSEMBLY.md](CONTEXT_ASSEMBLY.md)** - Context building

### Development Process
- **[DEVELOPMENT_JOURNAL_TEMPLATE.md](DEVELOPMENT_JOURNAL_TEMPLATE.md)** - How to document progress

## 🎯 Quick Start (When Implemented)

```bash
# Install Brain MCP server
cd /Users/bard/Code/brain
npm install
npm run build

# Brain will be available through these MCP tools:
brain:init       # Initialize session, load context
brain:status     # Check if initialized
brain:remember   # Store information  
brain:recall     # Retrieve with search
brain:execute    # Run code with feedback
brain:learn      # Capture patterns
brain:index      # Manage project documentation
brain:note       # Quick note capture (dual storage)
brain:notes      # Search and manage notes
```

## 🔑 Key Decisions

1. **Storage**: SQLite with JSON columns (no abstractions)
2. **Language**: TypeScript/Node.js (no bridges)
3. **Protocol**: MCP tools only (no HTTP during execution)
4. **Philosophy**: YAGNI + commit to decisions (see CODING_GUIDELINES.md)

## 📁 Project Structure (Planned)

```
/Users/bard/Code/brain/
├── src/
│   ├── core/              # Core system components
│   │   ├── brain.ts       # Central orchestrator
│   │   ├── database.ts    # Database connection
│   │   ├── server.ts      # MCP server setup
│   │   └── types.ts       # Shared types
│   │
│   ├── modules/           # Feature modules (stable interfaces)
│   │   ├── types.ts       # Module interfaces (source of truth)
│   │   ├── memory/        # Core memory operations
│   │   ├── notes/         # Note-taking system
│   │   ├── projects/      # Project index management
│   │   ├── execution/     # Code execution
│   │   └── sessions/      # Session management
│   │
│   └── tools/             # MCP tool wrappers
│       ├── init.ts        # brain:init
│       ├── remember.ts    # brain:remember
│       ├── recall.ts      # brain:recall
│       ├── execute.ts     # brain:execute
│       ├── note.ts        # brain:note
│       └── index.ts       # brain:index
│
├── docs/                  # Documentation
│   ├── changes/           # Change proposals
│   └── migrations/        # Migration guides
│
├── notes/                 # Project notes (dual storage)
├── data/                  # Runtime data (gitignored)
│   ├── brain.db          # SQLite database
│   └── backups/          # Auto-backups
│
├── scripts/               # Build and utility scripts
│   └── brain-mcp.sh      # Launch script
│
├── package.json          # Dependencies
├── tsconfig.json         # TypeScript config
└── CENTRAL_INDEX.md      # This file
```

## 🚀 Next Steps

1. [ ] Create basic project structure
2. [ ] Set up TypeScript and MCP SDK
3. [ ] Implement SQLite database layer
4. [ ] Build brain:init and brain:status
5. [ ] Add remaining tools incrementally
6. [ ] Test thoroughly
7. [ ] Execute cleanup/migration plan

## 🤝 Contributing

This is a personal project by Mikey Bee. The philosophy is:
- No placeholders in code
- Direct implementations over abstractions
- Commit to decisions
- Trust Git to remember alternatives

## 📋 Related Projects

- **Cortex_2** - Previous memory system (to be replaced)
- **Nexus_3** - Previous orchestration system (to be replaced)

---

*"One system to rule them all, and in the Brain bind them"*
