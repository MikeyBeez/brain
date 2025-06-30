/**
 * Sessions Module
 * 
 * Manages ephemeral session state with automatic cleanup.
 * Includes update method for session state changes.
 */

import { randomUUID } from 'crypto';
import { 
  SessionsModuleInterface,
  Session,
  BrainModule 
} from '../types.js';
import { getDatabase, logger } from '../../core/database.js';
import Database from 'better-sqlite3';

const SESSIONS_SCHEMA = `
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
`;

export class SessionsModule implements SessionsModuleInterface {
  private db: Database.Database;
  private initialized = false;
  
  // Configuration
  private readonly SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours
  private readonly CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour
  private cleanupTimer?: NodeJS.Timeout;
  
  // Prepared statements
  private stmts!: {
    create: Database.Statement;
    get: Database.Statement;
    update: Database.Statement;
    updateAccess: Database.Statement;
    cleanup: Database.Statement;
    logEvent: Database.Statement;
    getActive: Database.Statement;
    getByUser: Database.Statement;
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
      this.db.exec(SESSIONS_SCHEMA);
      
      // Prepare statements
      this.prepareStatements();
      
      // Start cleanup timer
      this.startCleanupTimer();
      
      // Run initial cleanup
      this.cleanupSessions();
      
      this.initialized = true;
      logger.info('Sessions module initialized');
    } catch (error) {
      logger.error('Failed to initialize sessions module', error);
      throw error;
    }
  }
  
  /**
   * Prepare SQL statements
   */
  private prepareStatements(): void {
    this.stmts = {
      create: this.db.prepare(`
        INSERT INTO sessions (id, user, data, metadata)
        VALUES (?, ?, ?, ?)
      `),
      
      get: this.db.prepare(`
        SELECT * FROM sessions WHERE id = ?
      `),
      
      update: this.db.prepare(`
        UPDATE sessions 
        SET data = ?, last_accessed = CURRENT_TIMESTAMP
        WHERE id = ?
      `),
      
      updateAccess: this.db.prepare(`
        UPDATE sessions 
        SET last_accessed = CURRENT_TIMESTAMP
        WHERE id = ?
      `),
      
      cleanup: this.db.prepare(`
        UPDATE sessions
        SET status = 'inactive'
        WHERE status = 'active'
        AND julianday('now') - julianday(last_accessed) > ?
      `),
      
      logEvent: this.db.prepare(`
        INSERT INTO session_events (session_id, event_type, event_data)
        VALUES (?, ?, ?)
      `),
      
      getActive: this.db.prepare(`
        SELECT COUNT(*) as count
        FROM sessions
        WHERE status = 'active'
      `),
      
      getByUser: this.db.prepare(`
        SELECT * FROM sessions
        WHERE user = ? AND status = 'active'
        ORDER BY last_accessed DESC
        LIMIT 1
      `)
    };
  }
  
  /**
   * Create a new session
   */
  create(): string {
    if (!this.initialized) this.initialize();
    
    try {
      const id = randomUUID();
      const user = process.env.USER || 'default';
      const metadata = {
        pid: process.pid,
        platform: process.platform,
        node_version: process.version
      };
      
      this.stmts.create.run(
        id,
        user,
        JSON.stringify({}),
        JSON.stringify(metadata)
      );
      
      // Log session creation
      this.stmts.logEvent.run(id, 'created', null);
      
      logger.info(`Session created: ${id}`);
      return id;
    } catch (error) {
      logger.error('Failed to create session', error);
      throw error;
    }
  }
  
  /**
   * Get a session by ID
   */
  get(id: string): Session | null {
    if (!this.initialized) this.initialize();
    
    try {
      const row = this.stmts.get.get(id) as any;
      
      if (!row) {
        return null;
      }
      
      // Update access time
      this.stmts.updateAccess.run(id);
      
      return {
        id: row.id,
        started_at: new Date(row.started_at),
        last_accessed: new Date(row.last_accessed),
        data: JSON.parse(row.data)
      };
    } catch (error) {
      logger.error(`Failed to get session: ${id}`, error);
      return null;
    }
  }
  
  /**
   * Update session data
   */
  update(id: string, data: any): void {
    if (!this.initialized) this.initialize();
    
    try {
      const serialized = JSON.stringify(data);
      const result = this.stmts.update.run(serialized, id);
      
      if (result.changes === 0) {
        throw new Error(`Session not found: ${id}`);
      }
      
      // Log update event
      this.stmts.logEvent.run(id, 'updated', serialized);
      
      logger.debug(`Session updated: ${id}`);
    } catch (error) {
      logger.error(`Failed to update session: ${id}`, error);
      throw error;
    }
  }
  
  /**
   * Clean up inactive sessions - returns number cleaned
   * This is the method from the interface
   */
  cleanup(): number {
    return this.cleanupSessions();
  }
  
  /**
   * Internal cleanup implementation
   */
  private cleanupSessions(): number {
    if (!this.initialized) return 0;  // Don't initialize, just return
    
    try {
      // Mark old sessions as inactive
      const timeoutDays = this.SESSION_TIMEOUT / (24 * 60 * 60 * 1000);
      const result = this.stmts.cleanup.run(timeoutDays);
      
      const cleaned = result.changes;
      if (cleaned > 0) {
        logger.info(`Cleaned up ${cleaned} inactive sessions`);
      }
      
      return cleaned;
    } catch (error) {
      logger.error('Failed to cleanup sessions', error);
      return 0;
    }
  }
  
  /**
   * Get or create session for current user
   */
  getOrCreateForUser(): string {
    const user = process.env.USER || 'default';
    const existing = this.stmts.getByUser.get(user) as any;
    
    if (existing) {
      logger.debug(`Resuming session for user ${user}: ${existing.id}`);
      return existing.id;
    }
    
    return this.create();
  }
  
  /**
   * Start periodic cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupSessions();
    }, this.CLEANUP_INTERVAL);
    
    // Ensure timer doesn't prevent process exit
    this.cleanupTimer.unref();
  }
  
  /**
   * Get session statistics
   */
  getStats(): { active: number; total: number } {
    const active = (this.stmts.getActive.get() as any).count;
    const total = this.db.prepare('SELECT COUNT(*) as count FROM sessions').get() as any;
    
    return {
      active,
      total: total.count
    };
  }
  
  /**
   * Validate module health
   */
  validate(): boolean {
    try {
      const tables = this.db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name IN ('sessions', 'session_events')
      `).all();
      
      return tables.length === 2;
    } catch (error) {
      logger.error('Sessions module validation failed', error);
      return false;
    }
  }
  
  /**
   * Get module name
   */
  getName(): string {
    return 'sessions';
  }
  
  /**
   * Get module capabilities
   */
  getCapabilities(): string[] {
    return ['create', 'get', 'update', 'cleanup'];
  }
}

// Export singleton instance
export const sessionsModule = new SessionsModule();
