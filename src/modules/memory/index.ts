/**
 * Memory Module
 * 
 * Core memory operations with tiering support (hot/warm/cold).
 * No delete method per YAGNI principle.
 */

import { createHash } from 'crypto';
import { 
  MemoryModuleInterface, 
  SearchResult,
  BrainModule 
} from '../types.js';
import { getDatabase, logger } from '../../core/database.js';
import Database from 'better-sqlite3';

const MEMORY_SCHEMA = `
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
`;

export class MemoryModule implements MemoryModuleInterface {
  private db: Database.Database;
  private initialized = false;
  
  // Prepared statements for performance
  private stmts!: {
    set: Database.Statement;
    get: Database.Statement;
    search: Database.Statement;
    updateAccess: Database.Statement;
    getHotMemories: Database.Statement;
    rebalanceTiers: Database.Statement;
    updateStats: Database.Statement;
  };
  
  constructor() {
    this.db = getDatabase();
  }
  
  /**
   * Initialize the module
   */
  initialize(): void {
    if (this.initialized) return;
    
    try {
      // Execute schema
      this.db.exec(MEMORY_SCHEMA);
      
      // Prepare statements
      this.prepareStatements();
      
      // Run initial tier rebalancing
      this.rebalanceTiers();
      
      this.initialized = true;
      logger.info('Memory module initialized');
    } catch (error) {
      logger.error('Failed to initialize memory module', error);
      throw error;
    }
  }
  
  /**
   * Prepare SQL statements
   */
  private prepareStatements(): void {
    this.stmts = {
      set: this.db.prepare(`
        INSERT INTO memories (key, value, type, checksum)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET
          value = excluded.value,
          type = excluded.type,
          checksum = excluded.checksum,
          updated_at = CURRENT_TIMESTAMP,
          access_count = access_count + 1
      `),
      
      get: this.db.prepare(`
        SELECT value FROM memories WHERE key = ?
      `),
      
      search: this.db.prepare(`
        SELECT 
          memories.key,
          memories.value,
          rank * (1.0 + LOG10(memories.access_count + 1)) as score
        FROM memories_fts 
        JOIN memories ON memories.id = memories_fts.rowid
        WHERE memories_fts MATCH ?
        AND memories.storage_tier IN ('hot', 'warm')
        ORDER BY score DESC
        LIMIT ?
      `),
      
      updateAccess: this.db.prepare(`
        UPDATE memories 
        SET 
          access_count = access_count + 1,
          accessed_at = CURRENT_TIMESTAMP
        WHERE key = ?
      `),
      
      getHotMemories: this.db.prepare(`
        SELECT key, value, 
          (julianday('now') - julianday(accessed_at)) as age_days,
          access_count
        FROM memories
        WHERE storage_tier = 'hot'
        ORDER BY 
          CASE 
            WHEN type = 'user_preferences' THEN 0
            WHEN type = 'active_project' THEN 1
            ELSE 2
          END,
          accessed_at DESC,
          access_count DESC
        LIMIT 300
      `),
      
      rebalanceTiers: this.db.prepare(`
        WITH tier_scores AS (
          SELECT 
            id,
            key,
            type,
            storage_tier,
            -- Calculate memory score
            (
              -- Recency score (exponential decay over 7 days)
              EXP(-(julianday('now') - julianday(accessed_at)) / 7.0) * 0.4 +
              -- Frequency score (log scale)
              LOG10(access_count + 1) * 0.4 +
              -- Type score
              CASE 
                WHEN type = 'user_preferences' THEN 10 * 0.2
                WHEN type = 'active_project' THEN 5 * 0.2
                ELSE 1 * 0.2
              END
            ) as score
          FROM memories
        )
        UPDATE memories
        SET storage_tier = 
          CASE
            WHEN id IN (SELECT id FROM tier_scores WHERE score >= 2.0) THEN 'hot'
            WHEN id IN (SELECT id FROM tier_scores WHERE score >= 0.5 AND score < 2.0) THEN 'warm'
            ELSE 'cold'
          END
      `),
      
      updateStats: this.db.prepare(`
        UPDATE memory_stats SET
          total_memories = (SELECT COUNT(*) FROM memories),
          hot_memories = (SELECT COUNT(*) FROM memories WHERE storage_tier = 'hot'),
          warm_memories = (SELECT COUNT(*) FROM memories WHERE storage_tier = 'warm'),
          cold_memories = (SELECT COUNT(*) FROM memories WHERE storage_tier = 'cold'),
          total_access_count = (SELECT SUM(access_count) FROM memories),
          last_update = CURRENT_TIMESTAMP
      `)
    };
  }
  
  /**
   * Store a memory
   */
  set(key: string, value: any, type: string = 'general'): void {
    if (!this.initialized) this.initialize();
    
    try {
      const serialized = JSON.stringify(value);
      const checksum = this.calculateChecksum(serialized);
      
      this.stmts.set.run(key, serialized, type, checksum);
      logger.debug(`Memory set: ${key} (type: ${type})`);
      
      // Update stats
      this.stmts.updateStats.run();
    } catch (error) {
      logger.error(`Failed to set memory: ${key}`, error);
      throw error;
    }
  }
  
  /**
   * Retrieve a memory
   */
  get(key: string): any {
    if (!this.initialized) this.initialize();
    
    try {
      const row = this.stmts.get.get(key) as { value: string } | undefined;
      
      if (!row) {
        return null;
      }
      
      // Update access tracking
      this.stmts.updateAccess.run(key);
      
      return JSON.parse(row.value);
    } catch (error) {
      logger.error(`Failed to get memory: ${key}`, error);
      return null;
    }
  }
  
  /**
   * Search memories using full-text search
   */
  search(query: string, limit: number = 10): SearchResult[] {
    if (!this.initialized) this.initialize();
    
    try {
      // Prepare FTS query (escape special characters)
      const ftsQuery = query.replace(/['"]/g, '""');
      
      const rows = this.stmts.search.all(ftsQuery, limit) as Array<{
        key: string;
        value: string;
        score: number;
      }>;
      
      return rows.map(row => ({
        key: row.key,
        value: JSON.parse(row.value),
        score: row.score
      }));
    } catch (error) {
      logger.error(`Failed to search memories: ${query}`, error);
      return [];
    }
  }
  
  /**
   * Get memories for initialization (max 300)
   */
  getInitMemories(): SearchResult[] {
    if (!this.initialized) this.initialize();
    
    try {
      const rows = this.stmts.getHotMemories.all() as Array<{
        key: string;
        value: string;
        age_days: number;
        access_count: number;
      }>;
      
      return rows.map(row => ({
        key: row.key,
        value: JSON.parse(row.value),
        score: 1.0 / (row.age_days + 1) // Simple recency score
      }));
    } catch (error) {
      logger.error('Failed to get init memories', error);
      return [];
    }
  }
  
  /**
   * Rebalance memory tiers based on access patterns
   */
  private rebalanceTiers(): void {
    try {
      this.stmts.rebalanceTiers.run();
      logger.debug('Memory tiers rebalanced');
    } catch (error) {
      logger.error('Failed to rebalance tiers', error);
    }
  }
  
  /**
   * Calculate checksum for data integrity
   */
  private calculateChecksum(data: string): string {
    return createHash('sha256').update(data).digest('hex');
  }
  
  /**
   * Validate module health
   */
  validate(): boolean {
    try {
      // Check if tables exist
      const tables = this.db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name IN ('memories', 'memory_stats')
      `).all();
      
      return tables.length === 2;
    } catch (error) {
      logger.error('Memory module validation failed', error);
      return false;
    }
  }
  
  /**
   * Cleanup resources
   */
  cleanup(): void {
    // Statements are cleaned up automatically
    logger.info('Memory module cleaned up');
  }
  
  /**
   * Get module name
   */
  getName(): string {
    return 'memory';
  }
  
  /**
   * Get module capabilities
   */
  getCapabilities(): string[] {
    return ['set', 'get', 'search', 'tiering'];
  }
}

// Export singleton instance
export const memoryModule = new MemoryModule();
