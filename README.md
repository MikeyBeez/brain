# Brain - Cognitive System for Claude

Brain is a comprehensive cognitive system that provides Claude with persistent memory, code execution, and learning capabilities through the Model Context Protocol (MCP).

## Documentation

This README serves as the primary documentation for the Brain system. The `docs/` directory contains the mise en place (preparation materials) that were assembled for vibe coding this repository, including engineering specifications, implementation guides, and technical specs that guided the development process.

## Features

- **Persistent Memory**: Store and recall information across conversations
- **Memory Tiering**: Automatic hot/warm/cold storage management
- **Session Management**: Maintain context within and across sessions
- **Full-Text Search**: Powerful search through all stored memories
- **Code Execution**: Execute Python and shell commands with full transparency
- **Execution Monitoring**: Real-time visibility into code execution via Monitex
- **User Preferences**: Personalized experience based on stored preferences
- **Project Awareness**: Track and maintain active project context

## Installation

1. Clone the repository:
```bash
cd /Users/bard/Code/brain
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env as needed
```

4. Build the project:
```bash
npm run build
```

## Usage

### Starting the Brain Server

```bash
npm start
```

Or for development with auto-reload:
```bash
npm run dev
```

### Available Tools

- **brain:init** - Initialize Brain session and load context
  - Loads user preferences, active project, and recent memories
  - Creates or resumes existing session

- **brain:remember** - Store information in memory
  - Examples:
    ```
    brain:remember user_preferences {"language": "Python", "style": "concise"}
    brain:remember active_project "/Users/bard/Code/myproject"
    brain:remember learned_pattern {"name": "error_handling", "solution": "..."}
    ```

- **brain:recall** - Search through memories
  - Full-text search across all stored information
  - Returns relevance-scored results

- **brain:status** - Check system health and statistics
  - Database health
  - Memory tier distribution
  - Session information

- **brain:execute** - Execute Python and shell code
  - Full Python execution environment with persistent state
  - Shell command execution via subprocess
  - Automatic language detection
  - Transparent logging of all executions
  - Integration with Monitex for real-time monitoring
  - Examples:
    ```
    brain:execute "print('Hello from Brain!')"
    brain:execute "ls -la" language="shell"
    brain:execute "import pandas as pd; df = pd.DataFrame({'a': [1,2,3]})"
    ```

## Architecture

Brain follows a modular architecture:

```
src/
├── core/           # Core infrastructure
│   ├── database.ts # Database connection
│   └── server.ts   # MCP server
├── modules/        # Feature modules
│   ├── types.ts    # All TypeScript interfaces
│   ├── memory/     # Memory storage and retrieval
│   ├── sessions/   # Session management
│   ├── notes/      # Note-taking (Phase 1)
│   ├── projects/   # Project indexing (Phase 1)
│   └── execution/  # Code execution (Phase 2)
└── tools/          # MCP tool implementations
```

## Development

### Running Tests

```bash
npm test                 # Run all tests
npm run test:watch      # Watch mode
npm run test:coverage   # Coverage report
```

### Linting and Formatting

```bash
npm run lint            # Check for lint errors
npm run format          # Format code with Prettier
npm run typecheck       # Type checking without building
```

## Phase 1 Progress

- ✅ Core infrastructure (database, server)
- ✅ Memory module with tiering
- ✅ Session management
- ✅ Basic MCP tools (init, remember, recall, status)
- ✅ Code execution module with Python/shell support
- ✅ Execution monitoring integration (Monitex)
- 🔲 Notes module (next)
- 🔲 Projects module
- 🔲 Pattern learning
- 🔲 Self-monitoring

## For Mikey Bee

Your preferences are automatically loaded when you use `brain:init`. The system will:
- Remember you prefer Python
- Remember you're interested in AI
- Never use placeholders in code
- Use your nom de plume in logs

To get started:
1. Run `brain:init` to initialize your session
2. Use `brain:remember` to store any preferences or context
3. Use `brain:recall` to search your memories

## License

MIT
