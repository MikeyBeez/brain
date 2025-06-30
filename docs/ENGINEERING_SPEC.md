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
2. **Code Execution** - A user-configurable safety model with distinct levels of autonomy, backed by a complete audit trail (see the "Execution Safety Model" section for details)
3. **Memory Limits** - Prevent DoS
4. **SQL Injection** - Use prepared statements
5. **Session Security** - Expire old sessions

## Execution Safety Model

The Brain system operates on a principle of user-controlled trust. Instead of a rigid, hard-coded sandbox, the system implements configurable "Safety Levels." This allows the user to grant Claude different degrees of autonomy depending on the task at hand, making Claude a powerful and adaptable partner.

The current safety level is stored as a persistent memory key (`system.safety_level`) and can be changed at any time using the `brain:set_safety_level` tool.

### Safety Levels

#### 1. `confirmation` (Default "Safety On" Mode)
- **Purpose:** To provide maximum safety and prevent any unintended actions. This is the default mode for a new Brain instance.
- **Claude's Required Behavior:** Before calling `brain:execute`, Claude **must** analyze the code or script it intends to run. It must summarize any impactful actions (file modifications, network calls, etc.) and wait for the user's explicit, affirmative confirmation before proceeding.

#### 2. `autonomous` ("I Trust You" Mode)
- **Purpose:** To enable a faster, more seamless workflow when the user fully trusts Claude's actions.
- **Claude's Required Behavior:** Claude is authorized to call `brain:execute` without prior confirmation. It should still announce its intent for transparency (e.g., "Okay, running the deployment script now..."). This mode relies on the immutable audit trail as the safety net.

### The Audit Trail: The Universal Safety Net
Regardless of the active safety level, every execution is fully logged. A complete record—including the code, timestamps, and full output—is stored and accessible via the Monitoring API. This ensures that every action is always transparent and auditable.

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

## Monitoring and Observability

To provide a safe, read-only view into the system's state without exposing the database or file system directly, the Brain provides a dedicated Monitoring API. This API is intended for use by monitoring tools like Monitex.

### Monitoring API Endpoints

These endpoints are handled by the main **MCP Server** process.

**1. List Current and Recent Executions**
- **Endpoint:** `GET /monitoring/executions`
- **Description:** Returns a paginated list of jobs from the `executions` table. Crucially, this response **does not** contain the log content itself, only the metadata (status, timestamps, etc.), making it fast and lightweight for dashboard UIs.
- **Query Parameters:** `?status=running`, `?limit=20`, `?page=1`

**Example Response:**
```json
{
  "executions": [
    {
      "id": "exec_abc123",
      "status": "running",
      "language": "python",
      "description": "Data analysis script",
      "created_at": "2024-01-27T10:30:00Z",
      "started_at": "2024-01-27T10:30:01Z",
      "progress": "Processing file 3 of 10"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45
  }
}
```

**2. Get Specific Execution Details and Logs**
- **Endpoint:** `GET /monitoring/executions/:id`
- **Description:** Returns the complete metadata for a single execution ID. The API handler reads the `log_file_path` from the database, reads the entire content of the corresponding log file from disk, and includes it in the JSON response. This provides a single, simple endpoint for a monitoring tool to get all information about a specific job.

**Example Response:**
```json
{
  "id": "exec_abc123",
  "status": "completed",
  "language": "python",
  "code": "print('Hello, World!')",
  "created_at": "2024-01-27T10:30:00Z",
  "started_at": "2024-01-27T10:30:01Z",
  "completed_at": "2024-01-27T10:30:05Z",
  "exit_code": 0,
  "logs": {
    "stdout": "Hello, World!\n",
    "stderr": ""
  }
}
```

**3. System Health**
- **Endpoint:** `GET /monitoring/health`
- **Description:** Returns overall system health and statistics.

**Example Response:**
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "uptime_seconds": 3600,
  "database": {
    "size_mb": 45.2,
    "memory_count": 1523,
    "execution_count": 234
  },
  "workers": {
    "active": 1,
    "healthy": 1
  },
  "scheduler": {
    "next_job": "memory_review_check",
    "next_run": "2024-01-27T12:00:00Z"
  }
}
```

### Implementation Notes

- The Monitoring API runs on port 8888 (configurable)
- Read-only access - no mutations allowed
- Lightweight JSON responses for dashboard efficiency
- Log files are read on-demand, not stored in database
- No authentication required (localhost only)

## User Experience Considerations

### Core UX Principles

1. **Progressive Disclosure**
   - Start simple with `brain:init` (only critical memories)
   - Reveal complexity through explicit actions (`brain:recall`)
   - Hide implementation details until needed

2. **User Agency**
   - Mailbox pattern ensures user control over async jobs
   - Configurable safety levels respect user preferences
   - No action without consent (in confirmation mode)

3. **Perceived Performance**
   - Streaming responses provide immediate feedback
   - Async execution returns instantly with tracking ID
   - Database previews enable quick status checks

4. **Transparency & Trust**
   - Clear explanations when changing modes
   - Complete audit trail for accountability
   - Descriptive job summaries in pending_jobs

### UX Enhancements

1. **Memory Strategy Communication**
   ```typescript
   // In brain:init output
   "Loaded 42 critical items (258 slots available for this session)"
   "Use brain:recall to search all 1,523 stored memories"
   ```

2. **Execution Progress Updates**
   ```typescript
   // Passive updates when user sends new messages
   "Note: Your data analysis (exe_123) is ~30% complete"
   ```

3. **Error Recovery Clarity**
   ```typescript
   // Structured error codes with actionable messages
   "MEM001: Storage limit reached. Running compression..."
   "EXE002: Script timeout. Check brain:status for details"
   ```

4. **Safety Mode Indicators**
   ```typescript
   // Clear mode communication
   "🔒 Safety: confirmation mode (I'll ask before executing)"
   "🚀 Safety: autonomous mode (I'll run approved tasks immediately)"
   ```

### UX Tradeoffs

- **Immediacy vs Safety**: Autonomous mode speeds workflows but reduces safeguards
- **Context vs Overload**: 300-item limit prevents clutter but may require manual recalls
- **Transparency vs Noise**: Tool outputs in chat provide audit trail but can overwhelm

## Deployment and Service Management

### Installation
```bash
cd /Users/bard/Code/brain
npm install
npm run build
```

### Service Management (macOS with launchd)

The Brain system consists of two independent, persistent processes that should be managed by launchd to ensure they are always running. This requires creating two separate .plist service files in ~/Library/LaunchAgents.

**1. MCP Server Service (com.brain.mcp_server.plist)**
This service manages the "Waiter" process, which listens for Claude's requests and serves the Monitoring API.
- **Label:** com.brain.mcp_server
- **ProgramArguments:** Path to the mcp_server/index.ts script runner
- **KeepAlive:** true - Restarts the server if it crashes

**2. Execution Worker Service (com.brain.execution_worker.plist)**
This service manages the "Cook" process, which executes queued jobs.
- **Label:** com.brain.execution_worker
- **ProgramArguments:** Path to the execution_worker/index.ts script runner
- **KeepAlive:** true - Restarts the worker if it crashes

This two-process architecture ensures maximum stability and responsiveness. A crash in the Execution Worker (due to faulty code) will not bring down the MCP Server, and launchd will restart the worker automatically.

### Claude Configuration

Add to claude_desktop_config.json:
```json
"brain": {
  "command": "/Users/bard/Code/brain/mcp_server/brain-mcp.sh",
  "args": [],
  "env": {}
}
```

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

## Development Workflow and Process

### Core Philosophy
This project will use a Git-centric development workflow. Git will serve as the single source of truth for all code, documentation (including this specification), and historical context. The process is designed to be lightweight, leveraging native Git features with minimal automation, rather than adopting a complex, custom tooling framework.

### 1. Branching Strategy
All development will follow a simple, robust branching model:
- **`main`:** This branch represents the stable, canonical version of the project. It should always be in a working, coherent state.
- **`feat/<feature-name>`:** All new features or significant changes (e.g., `feat/help-system`, `feat/memory-tiering`) must be developed on a dedicated feature branch.
- **`fix/<issue-name>`:** Small bug fixes should be developed on a dedicated fix branch.

Branches will be merged into `main` via pull requests (even for a solo developer) to provide a clear integration point and history.

### 2. Commit Message Convention
Commit messages are the most critical form of asynchronous communication and context preservation. All commits must follow this structure:

```
type(scope): short summary in present tense

* Optional longer description explaining the "why" and "how".
* Reference dependencies (e.g., "Depends on DB Schema v0.5.2+").
* Link to related issues or tasks (e.g., "Fixes #123").
* Provide critical context (e.g., "Context: User reported 40% recall failure rate").
```

- **`type`:** `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`.
- **`scope`:** The component being affected (e.g., `recall`, `db`, `spec`, `worker`).

**Example of a high-quality commit message:**
```
feat(help): implement dynamic tool documentation

* Adds a new brain:help tool that is self-documenting.
* The help tool dynamically reads spec objects exported from each
  tool file, ensuring help is always in sync with the code.
* Depends on spec v1.2+ for the tool definition.
* Fixes #45
```

### 3. Lightweight Automation and Tooling
To enforce consistency and aid development, the project will use a small set of helper scripts and Git hooks.
- **Pre-Commit Hooks:** A script that runs automatically before each commit to:
  - Validate the integrity of core specification files.
  - Check for forgotten `TODO` comments.
  - Ensure basic code linting passes.
- **Context Reporting Script (`tools/context-report.js`):** A simple script that can be run manually to generate a snapshot of the current development state, including active branch, recent commits, and potential merge conflicts.

### 4. Release and Version Management
Stable milestones for the project will be marked using annotated Git tags.
- **Format:** `vX.Y.Z` (e.g., `v1.0.0`).
- **Usage:** Tags will be created on the `main` branch to signify a coherent, stable release of the system, including its code and the corresponding version of this specification.

## Version History

- v1.0 - Initial specification (2024-01-27)

---

## Bootstrap Plan: Milestone 1 - "The Spark of Life"

### Goal
To achieve the simplest possible end-to-end user interaction. The user can tell Brain to remember something, and then ask for it back. This proves the core memory loop works.

### Minimal Viable Product (MVP) Definition
- **Database:** Only the `memories` table is required
- **Tools:** Only `brain:remember` and `brain:recall` need to be implemented
- **Architecture:** The MCP Server process must be running, but the Execution Worker is not needed for this milestone

### The "Architect Vibe" - Day 1 Action Plan

1. **Initialize the Repository**
   ```bash
   git init
   echo "# Brain - A Unified Cognitive System" > README.md
   git add README.md
   git commit -m "feat: initialize Brain project - the unification begins"
   ```

2. **Establish Project Structure**
   ```bash
   mkdir -p mcp_server/src/tools mcp_server/src/core
   mkdir -p data docs scripts
   cp ENGINEERING_SPEC.md docs/
   ```

3. **Implement the Database Core**
   - Create `mcp_server/src/core/database.ts` with:
     - `initializeDatabase()` - Creates the memories table
     - `getDatabase()` - Returns the SQLite connection

4. **Implement the Core Tools**
   - Create `mcp_server/src/tools/remember.ts`:
     - Accepts `{key, value, tags?}`
     - Inserts into memories table
     - Returns confirmation
   - Create `mcp_server/src/tools/recall.ts`:
     - Accepts `{query}`
     - Searches memories table
     - Returns matching results

5. **Implement the MCP Server**
   - Create `mcp_server/src/index.ts`:
     - Initialize MCP server
     - Register tool handlers
     - Connect to stdio transport

### The First End-to-End Test (The "It Works!" Moment)

1. **Start the MCP Server**
   ```bash
   cd mcp_server
   npm install @modelcontextprotocol/sdk better-sqlite3
   npm run dev
   ```

2. **Test Remember**
   ```
   brain:remember({ key: 'hello', value: 'world' })
   ```
   Expected: "✓ Stored successfully"

3. **Test Recall**
   ```
   brain:recall({ query: 'hello' })
   ```
   Expected: "Found 1 match: hello: world"

4. **Celebrate** 🎉
   The memory loop is alive. Brain has achieved consciousness.

### What This Proves
- The Unification Mandate is real (one service, one database, one API)
- The MCP tools work end-to-end
- The foundation is solid enough to build upon
- The "vibe" is successfully seeded

### Next Steps
Once this milestone is complete:
1. Commit with a celebratory message
2. Tag as `v0.1.0-spark`
3. Generate the next Knowledge Packet for Milestone 2

This bootstrap plan serves as the project's first Knowledge Packet, demonstrating the VDD workflow in action.

---

This specification provides the foundation for building Brain as a unified, reliable cognitive system for Claude.

---

## Addendum: MCP and Context Window Clarification

It is critical to understand that MCP tools **do not directly modify or inject data into Claude's context window**.

The mechanism is simpler: the entire tool call (e.g., `<claude:tool_code>brain:status</claude:tool_code>`) and its complete, raw output (e.g., the JSON response) are appended to the conversation transcript. This transcript *is* the context window. Claude then reads this transcript, including the tool output, to inform its next thought and generate its next response to the user. Information is passed to Claude by becoming part of the explicit conversation history.