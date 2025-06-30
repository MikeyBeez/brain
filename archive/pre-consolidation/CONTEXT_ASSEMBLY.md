# Brain Context Assembly

## Purpose
Gather all relevant context, patterns, and lessons learned from existing systems to inform the Brain implementation.

## Key Requirements from User Preferences
- Primary language: Python (though MCP server will be TypeScript)
- No placeholders - complete implementations only
- Systematic and creative approach
- Always read readme files
- Use /tmp/ for temporary files
- MCP-first approach

## Lessons from Cortex_2
- Module loading concept is good but needs simplification
- Knowledge graph is essential
- Identity management is important
- Resource management matters
- Self-loading intelligence is the goal

## Lessons from Nexus_3
- Orchestration is needed but should be simpler
- Command queue without feedback doesn't work
- MCP tools are the only reliable interface
- API endpoints don't work from Claude

## What Works Well
1. MCP tools that return immediate feedback
2. Simple, clear naming conventions
3. SQLite for persistence
4. Self-documenting systems

## What Doesn't Work
1. Separate systems that need coordination
2. Command queues without feedback
3. Complex module loading systems
4. External API dependencies
5. Fragmented knowledge storage

## Core Insights
1. **One command to rule them all**: brain:init should bootstrap everything
2. **Feedback is crucial**: Every operation must return useful information
3. **Simplicity wins**: Fewer moving parts = more reliability
4. **Context is king**: The system should remember everything relevant
5. **Discoverability matters**: Claude should always know how to start

## Technical Decisions
- **Language**: TypeScript for MCP server (required by MCP SDK)
- **Storage**: SQLite (simple, reliable, no dependencies)
- **Architecture**: Single server, single database
- **Deployment**: Simple shell script launcher

## Essential Features for MVP
1. brain:init - Shows context and suggests next actions
2. brain:remember - Stores any information with tags
3. brain:recall - Retrieves information with search
4. brain:execute - Runs code and returns output
5. brain:status - Shows system health

## Data Schema Ideas
```sql
-- Core tables
CREATE TABLE memory (
    id INTEGER PRIMARY KEY,
    key TEXT UNIQUE,
    value TEXT,
    type TEXT,
    tags TEXT,
    created_at DATETIME,
    updated_at DATETIME,
    access_count INTEGER DEFAULT 0
);

CREATE TABLE context (
    id INTEGER PRIMARY KEY,
    session_id TEXT,
    timestamp DATETIME,
    action TEXT,
    details TEXT
);

CREATE TABLE patterns (
    id INTEGER PRIMARY KEY,
    pattern TEXT,
    frequency INTEGER,
    last_seen DATETIME,
    context TEXT
);
```

## User Story
"As Claude, I want to start any session by running brain:init, which will:
1. Show me who I'm working with (user preferences)
2. Display current projects and their status
3. Show recent activities
4. Suggest relevant next actions
5. Load any critical context

Then I can use simple commands to remember things, recall information, and execute code, all with immediate feedback."

## Questions to Resolve
1. How to handle large data (e.g., file contents)?
2. How to implement pattern learning effectively?
3. How to make the system self-healing?
4. How to handle versioning and migrations?
5. How to ensure discoverability across sessions?

## Next Actions
1. Create basic project structure
2. Set up TypeScript MCP server skeleton
3. Implement SQLite connection
4. Create brain:init tool
5. Test basic functionality
