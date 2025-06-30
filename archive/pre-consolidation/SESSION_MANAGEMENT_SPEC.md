# Brain Session Management Specification

## Overview
Brain needs to track initialization per chat session to avoid duplicate loading while ensuring context is always available.

## Session State Management

### In-Memory Session Store
```typescript
interface Session {
  id: string;
  startedAt: Date;
  lastAccessed: Date;
  initData: {
    user: string;
    preferences: any;
    context: any;
  };
  actionCount: number;
}

class SessionManager {
  private sessions: Map<string, Session> = new Map();
  
  createSession(): string {
    const id = `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.sessions.set(id, {
      id,
      startedAt: new Date(),
      lastAccessed: new Date(),
      initData: null,
      actionCount: 0
    });
    return id;
  }
  
  getSession(id: string): Session | null {
    const session = this.sessions.get(id);
    if (session) {
      session.lastAccessed = new Date();
      session.actionCount++;
    }
    return session || null;
  }
  
  // Clean up old sessions (>24 hours)
  cleanup() {
    const cutoff = Date.now() - (24 * 60 * 60 * 1000);
    for (const [id, session] of this.sessions) {
      if (session.lastAccessed.getTime() < cutoff) {
        this.sessions.delete(id);
      }
    }
  }
}
```

### MCP Tool Responses

#### brain:status
```typescript
async function status(sessionId?: string) {
  // If no session ID provided, check if any active sessions exist
  if (!sessionId) {
    return {
      status: 'not_initialized',
      message: 'Brain not initialized. Run brain:init to start.'
    };
  }
  
  const session = sessionManager.getSession(sessionId);
  if (!session) {
    return {
      status: 'expired',
      message: 'Session expired. Run brain:init to start new session.'
    };
  }
  
  return {
    status: 'active',
    sessionId: session.id,
    startedAt: session.startedAt,
    duration: `${Math.floor((Date.now() - session.startedAt.getTime()) / 1000 / 60)} minutes`,
    actionCount: session.actionCount,
    user: session.initData?.user || 'unknown'
  };
}
```

#### brain:init
```typescript
async function init(sessionId?: string) {
  // Check if session already exists
  if (sessionId) {
    const existing = sessionManager.getSession(sessionId);
    if (existing && existing.initData) {
      return {
        status: 'already_initialized',
        sessionId: existing.id,
        message: 'Brain already initialized for this session.',
        startedAt: existing.startedAt,
        user: existing.initData.user
      };
    }
  }
  
  // Create new session or use existing
  const id = sessionId || sessionManager.createSession();
  const session = sessionManager.getSession(id);
  
  // Load user data and context
  const userData = await loadUserPreferences();
  const context = await loadCurrentContext();
  
  session.initData = {
    user: userData.name,
    preferences: userData.preferences,
    context: context
  };
  
  return {
    status: 'initialized',
    sessionId: id,
    user: userData.name,
    greeting: `Welcome back, ${userData.name}!`,
    preferences: userData.preferences,
    recentActivity: context.recentActivity,
    suggestions: context.suggestions,
    instructions: 'Session initialized. Brain will maintain context for this chat.'
  };
}
```

### Session Flow

1. **First brain:status in chat**
   - No session ID provided
   - Returns 'not_initialized'
   - Prompts to run brain:init

2. **brain:init creates session**
   - Generates unique session ID
   - Loads user preferences and context
   - Returns session ID for future calls

3. **Subsequent brain:status calls**
   - Include session ID from init
   - Return 'active' status
   - Update last accessed time

4. **All other brain:* commands**
   - Require session ID
   - Update session activity
   - Maintain context

## Storage Considerations

### What's Stored in Session (Memory)
- Session ID and timestamps
- Loaded user preferences
- Current context
- Action count

### What's Stored in Database (Persistent)
- User preferences
- Knowledge graph
- Command history
- Learned patterns

## Error Recovery

If Brain crashes and restarts:
1. Sessions are lost (in-memory)
2. brain:status returns 'not_initialized'
3. brain:init reloads from persistent storage
4. New session continues seamlessly

## Implementation Priority

1. Basic session creation and tracking
2. Session-aware brain:init and brain:status
3. Session ID threading through all commands
4. Cleanup mechanism for old sessions
5. Graceful handling of restarts

This approach ensures:
- Brain loads once per chat
- Context is maintained throughout session
- System can recover from crashes
- No duplicate initialization
- Clean session management
