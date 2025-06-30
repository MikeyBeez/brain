-- Sessions Module Schema
--
-- Manages ephemeral session state with automatic cleanup.

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    started_at TEXT DEFAULT CURRENT_TIMESTAMP,
    last_accessed TEXT DEFAULT CURRENT_TIMESTAMP,
    data TEXT DEFAULT '{}', -- JSON session data
    user TEXT DEFAULT 'default',
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    metadata TEXT DEFAULT '{}'  -- JSON metadata
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sessions_last_accessed ON sessions(last_accessed DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user);

-- Auto-update last_accessed trigger
CREATE TRIGGER IF NOT EXISTS sessions_update_access
AFTER UPDATE OF data ON sessions
FOR EACH ROW
BEGIN
    UPDATE sessions 
    SET last_accessed = CURRENT_TIMESTAMP 
    WHERE id = NEW.id;
END;

-- Session events table (for tracking activity)
CREATE TABLE IF NOT EXISTS session_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    event_data TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Indexes for events
CREATE INDEX IF NOT EXISTS idx_session_events_session ON session_events(session_id);
CREATE INDEX IF NOT EXISTS idx_session_events_created ON session_events(created_at DESC);
