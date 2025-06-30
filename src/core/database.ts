/**
 * Core Database Module
 * 
 * Provides the central database connection for all Brain modules.
 * Uses better-sqlite3 for synchronous operations.
 */

import Database from 'better-sqlite3';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import winston from 'winston';

// Create logger with only console transport initially
// IMPORTANT: For MCP servers, all logs must go to stderr, not stdout
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple(),
      stderrLevels: ['error', 'warn', 'info', 'verbose', 'debug', 'silly'] // All levels to stderr
    })
  ]
});

export class DatabaseConnection {
  private static instance: Database.Database | null = null;
  private static readonly DATA_DIR = process.env.BRAIN_DATA_DIR || './data';
  private static readonly DB_PATH = join(DatabaseConnection.DATA_DIR, 'brain.db');
  
  /**
   * Get the singleton database instance
   */
  static getInstance(): Database.Database {
    if (!this.instance) {
      this.initialize();
    }
    return this.instance!;
  }
  
  /**
   * Initialize the database connection
   */
  private static initialize(): void {
    try {
      // Ensure data directory exists
      if (!existsSync(this.DATA_DIR)) {
        mkdirSync(this.DATA_DIR, { recursive: true });
        logger.info('Created data directory', { path: this.DATA_DIR });
      }
      
      // Add file logger with rotation after directory is created
      logger.add(new winston.transports.File({ 
        filename: join(this.DATA_DIR, 'brain.log'),
        maxsize: 5 * 1024 * 1024, // 5MB
        maxFiles: 5,
        tailable: true
      }));
      
      // Create database connection
      this.instance = new Database(this.DB_PATH, {
        verbose: process.env.LOG_LEVEL === 'debug' ? logger.debug.bind(logger) : undefined
      });
      
      // Configure database
      this.configurePragmas();
      
      // Initialize schema
      this.initializeSchema();
      
      // Set up graceful shutdown
      this.setupShutdownHandlers();
      
      logger.info('Database initialized successfully', { path: this.DB_PATH });
    } catch (error) {
      logger.error('Failed to initialize database', error);
      throw error;
    }
  }
  
  /**
   * Configure SQLite pragmas for optimal performance
   */
  private static configurePragmas(): void {
    if (!this.instance) return;
    
    // Enable WAL mode for better concurrency
    this.instance.pragma('journal_mode = WAL');
    
    // Set synchronous mode to NORMAL for better performance
    this.instance.pragma('synchronous = NORMAL');
    
    // Enable foreign keys
    this.instance.pragma('foreign_keys = ON');
    
    // Set cache size to 10MB
    this.instance.pragma('cache_size = -10000');
    
    // Enable query planner optimizations
    this.instance.pragma('optimize');
    
    logger.debug('Database pragmas configured');
  }
  
  /**
   * Initialize core schema
   */
  private static initializeSchema(): void {
    if (!this.instance) return;
    
    // Create schema version table
    this.instance.exec(`
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY,
        applied_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // Create migration history table
    this.instance.exec(`
      CREATE TABLE IF NOT EXISTS migration_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        version INTEGER NOT NULL,
        description TEXT,
        applied_at TEXT DEFAULT CURRENT_TIMESTAMP,
        checksum TEXT NOT NULL
      );
    `);
    
    logger.debug('Core schema initialized');
  }
  
  /**
   * Set up graceful shutdown handlers
   */
  private static setupShutdownHandlers(): void {
    const shutdown = () => {
      if (this.instance) {
        logger.info('Closing database connection');
        
        // Checkpoint WAL file
        this.instance.pragma('wal_checkpoint(TRUNCATE)');
        
        // Close the database
        this.instance.close();
        this.instance = null;
      }
    };
    
    // Handle various shutdown signals
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    process.on('exit', shutdown);
  }
  
  /**
   * Run database integrity check
   */
  static checkIntegrity(): { healthy: boolean; issues?: string[] } {
    const db = this.getInstance();
    const result = db.pragma('integrity_check') as Array<{ integrity_check: string }>;
    
    if (result[0].integrity_check === 'ok') {
      return { healthy: true };
    }
    
    return {
      healthy: false,
      issues: result.map(r => r.integrity_check)
    };
  }
  
  /**
   * Get database statistics
   */
  static getStats() {
    const db = this.getInstance();
    
    return {
      page_count: (db.pragma('page_count') as any)[0].page_count,
      page_size: (db.pragma('page_size') as any)[0].page_size,
      cache_size: (db.pragma('cache_size') as any)[0].cache_size,
      journal_mode: (db.pragma('journal_mode') as any)[0].journal_mode,
      wal_checkpoint: (db.pragma('wal_checkpoint(PASSIVE)') as any)[0]
    };
  }
}

// Export convenience function
export function getDatabase(): Database.Database {
  return DatabaseConnection.getInstance();
}

// Export logger for use in other modules
export { logger };
