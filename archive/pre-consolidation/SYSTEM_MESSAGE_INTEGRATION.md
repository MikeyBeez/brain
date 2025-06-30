# Brain System Message Integration

## The Solution
Add instructions to Claude's system message to check for and load Brain once per chat session.

## Proposed System Message Addition

```
At the start of each conversation, check if Brain is loaded by running:
brain:status

If Brain is not loaded or returns an error, run:
brain:init

This should only be done ONCE per conversation. After successful initialization, Brain will maintain context for the entire session.
```

## Implementation Details

### 1. Session Tracking
Brain should track if it's been initialized in the current session:
- Store a session ID when brain:init is called
- brain:status returns this session ID
- If session ID exists, skip initialization

### 2. brain:status Response Format
```
Brain Status:
- Session: active (initialized 2 minutes ago)
- Session ID: chat_xyz123
- Memory: 42 items stored
- Last action: brain:remember "project_context" 
- Health: OK
```

### 3. brain:init Idempotency
If brain:init is called multiple times in same session:
```
Brain already initialized for this session.
Session ID: chat_xyz123
Started: 2 minutes ago

Use brain:status for current status
Use brain:recall for stored information
```

### 4. Error Handling
If Brain is not available:
```
Brain MCP server not found. 

To set up Brain:
1. Check if Brain is installed at /Users/bard/Code/brain/
2. Ensure brain MCP server is configured in Claude
3. Contact user for assistance

Working without Brain - limited context available.
```

## Benefits

1. **Automatic Loading** - Claude always has context
2. **No Duplicate Loads** - Efficient use of resources  
3. **Graceful Fallback** - Still works if Brain unavailable
4. **Session Awareness** - Maintains context per conversation

## Session Lifecycle

```
New Chat Started
      ↓
Claude runs brain:status
      ↓
    Loaded? ──No──→ Run brain:init
      ↓                    ↓
     Yes                  Load context
      ↓                    ↓
Skip init               Store session ID
      ↓                    ↓
    Continue ←─────────────┘
```

## Example Interaction

```
[New chat starts]

Claude (internally): Let me check Brain status...
> brain:status
< Error: Brain not initialized

> brain:init
< Brain initialized!
  Session ID: chat_abc123
  User: Mikey Bee
  Context: 3 active projects
  Last activity: Working on cortex_2
  
  Ready to help! What would you like to work on?

[Later in same chat]

Claude (internally): Checking Brain again...
> brain:status  
< Brain Status: Active (Session: chat_abc123)

[Claude continues without re-initializing]
```

## Critical Design Points

1. **Session ID Generation**: Use timestamp + random string
2. **Persistence**: Session data stays in memory, not database
3. **Timeout**: Sessions expire after 24 hours
4. **Lightweight**: brain:status must be fast (<50ms)

## Integration with Existing Tools

- brain:init sets up session
- brain:status checks session
- brain:remember includes session context
- brain:recall filters by relevance to session
- brain:execute logs to session history

This ensures Brain becomes an invisible but essential part of every Claude conversation where it's available.
