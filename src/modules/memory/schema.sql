-- Memory Module Schema
-- 
-- Stores all memories with tiering support for hot/warm/cold storage.
-- Includes full-text search and relationship tracking.

-- Main memories table
CREATE TABLE IF NOT EXISTS memories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL UNIQUE,
    value TEXT NOT NULL, -- JSON serialized data
    type TEXT DEFAULT 'general',
    storage_tier TEXT DEFAULT 'hot' CHECK (storage_tier IN ('hot', 'warm', 'cold')),
    access_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    accessed_at TEXT DEFAULT CURRENT_TIMESTAMP,
    metadata TEXT DEFAULT '{}', -- JSON metadata
    embedding BLOB, -- Future: vector embeddings
    checksum TEXT -- SHA256 of value for integrity
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_memories_key ON memories(key);
CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(type);
CREATE INDEX IF NOT EXISTS idx_memories_tier ON memories(storage_tier);
CREATE INDEX IF NOT EXISTS idx_memories_access ON memories(accessed_at DESC, access_count DESC);
CREATE INDEX IF NOT EXISTS idx_memories_composite ON memories(
    storage_tier, type, accessed_at DESC, access_count DESC
);

-- Full-text search
CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
    key,
    value,
    type,
    content=memories,
    content_rowid=id
);

-- Triggers to keep FTS in sync
CREATE TRIGGER IF NOT EXISTS memories_fts_insert 
AFTER INSERT ON memories BEGIN
    INSERT INTO memories_fts(rowid, key, value, type) 
    VALUES (new.id, new.key, new.value, new.type);
END;

CREATE TRIGGER IF NOT EXISTS memories_fts_update 
AFTER UPDATE ON memories BEGIN
    UPDATE memories_fts 
    SET key = new.key, value = new.value, type = new.type 
    WHERE rowid = new.id;
END;

CREATE TRIGGER IF NOT EXISTS memories_fts_delete 
AFTER DELETE ON memories BEGIN
    DELETE FROM memories_fts WHERE rowid = old.id;
END;

-- Update timestamp trigger
CREATE TRIGGER IF NOT EXISTS memories_update_timestamp 
AFTER UPDATE ON memories
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE memories SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Memory relationships table (for future use)
CREATE TABLE IF NOT EXISTS memory_relationships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id INTEGER NOT NULL,
    target_id INTEGER NOT NULL,
    relationship_type TEXT NOT NULL,
    strength REAL DEFAULT 1.0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (source_id) REFERENCES memories(id) ON DELETE CASCADE,
    FOREIGN KEY (target_id) REFERENCES memories(id) ON DELETE CASCADE,
    UNIQUE(source_id, target_id, relationship_type)
);

-- Memory statistics table (materialized view pattern)
CREATE TABLE IF NOT EXISTS memory_stats (
    total_memories INTEGER,
    hot_memories INTEGER,
    warm_memories INTEGER,
    cold_memories INTEGER,
    total_access_count INTEGER,
    last_update TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Initialize stats if empty
INSERT OR IGNORE INTO memory_stats VALUES (0, 0, 0, 0, 0, CURRENT_TIMESTAMP);
