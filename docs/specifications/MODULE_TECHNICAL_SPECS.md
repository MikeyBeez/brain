# Brain Module Technical Specifications

## Memory Module Detailed Specification

### Schema

```sql
-- Main memory table with comprehensive metadata
CREATE TABLE memories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    value JSON NOT NULL,
    type TEXT DEFAULT 'general',
    tags TEXT, -- Comma-separated tags
    
    -- Temporal tracking
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Usage metrics
    access_count INTEGER DEFAULT 0,
    update_count INTEGER DEFAULT 0,
    
    -- Tiering and optimization
    storage_tier TEXT DEFAULT 'warm' CHECK(storage_tier IN ('hot', 'warm', 'cold')),
    memory_score REAL DEFAULT 0.5, -- Calculated importance score
    
    -- Metadata
    source TEXT, -- Where this memory came from
    context JSON, -- Additional context about the memory
    checksum TEXT, -- SHA256 of value for integrity
    size_bytes INTEGER, -- Size of the value
    
    -- Relationships
    related_memories TEXT, -- Comma-separated IDs
    supersedes INTEGER REFERENCES memories(id), -- If this replaces another memory
    
    -- Flags
    is_system BOOLEAN DEFAULT 0, -- System-critical memory
    is_private BOOLEAN DEFAULT 0, -- Should not be exposed in search
    is_compressed BOOLEAN DEFAULT 0 -- If value is compressed
);

-- Indexes for performance
CREATE INDEX idx_memories_key_type ON memories(key, type);
CREATE INDEX idx_memories_tier_score ON memories(storage_tier, memory_score DESC);
CREATE INDEX idx_memories_access ON memories(accessed_at DESC, access_count DESC);
CREATE INDEX idx_memories_type_tier ON memories(type, storage_tier);
CREATE INDEX idx_memories_tags ON memories(tags) WHERE tags IS NOT NULL;

-- Full-text search
CREATE VIRTUAL TABLE memories_fts USING fts5(
    key, 
    value, 
    tags,
    content=memories,
    tokenize='unicode61 remove_diacritics 2'
);

-- Triggers for FTS maintenance
CREATE TRIGGER memories_fts_insert AFTER INSERT ON memories BEGIN
    INSERT INTO memories_fts(rowid, key, value, tags) 
    VALUES (new.id, new.key, new.value, new.tags);
END;

CREATE TRIGGER memories_fts_update AFTER UPDATE ON memories BEGIN
    UPDATE memories_fts 
    SET key = new.key, value = new.value, tags = new.tags 
    WHERE rowid = new.id;
END;

CREATE TRIGGER memories_fts_delete AFTER DELETE ON memories BEGIN
    DELETE FROM memories_fts WHERE rowid = old.id;
END;

-- Memory relationships table
CREATE TABLE memory_relations (
    from_memory_id INTEGER REFERENCES memories(id) ON DELETE CASCADE,
    to_memory_id INTEGER REFERENCES memories(id) ON DELETE CASCADE,
    relation_type TEXT NOT NULL, -- 'related', 'derived', 'contradicts', etc.
    strength REAL DEFAULT 0.5, -- Relationship strength 0-1
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (from_memory_id, to_memory_id, relation_type)
);
```

### Implementation

```typescript
export class MemoryModule implements MemoryModuleInterface {
  private statements: PreparedStatements;
  private compressionThreshold = 1024; // Compress values > 1KB
  
  initialize(): void {
    // Create schema
    this.db.exec(MEMORY_SCHEMA);
    
    // Prepare all statements
    this.statements = {
      set: this.db.prepare(`
        INSERT INTO memories (key, value, type, tags, source, context, checksum, size_bytes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET
          value = excluded.value,
          type = excluded.type,
          tags = excluded.tags,
          updated_at = CURRENT_TIMESTAMP,
          update_count = update_count + 1,
          checksum = excluded.checksum,
          size_bytes = excluded.size_bytes,
          memory_score = memory_score * 0.9 + 0.1 -- Slight boost on update
      `),
      
      get: this.db.prepare(`
        UPDATE memories 
        SET accessed_at = CURRENT_TIMESTAMP,
            access_count = access_count + 1,
            memory_score = MIN(1.0, memory_score * 0.95 + 0.05)
        WHERE key = ?
        RETURNING value, type, tags, context
      `),
      
      search: this.db.prepare(`
        SELECT 
          m.key,
          m.value,
          m.type,
          m.tags,
          m.memory_score,
          rank
        FROM memories m
        JOIN memories_fts f ON m.id = f.rowid
        WHERE memories_fts MATCH ?
          AND m.is_private = 0
          AND m.storage_tier IN ('hot', 'warm')
        ORDER BY rank * m.memory_score DESC
        LIMIT ?
      `),
      
      updateScore: this.db.prepare(`
        UPDATE memories
        SET memory_score = ?
        WHERE id = ?
      `),
      
      promoteTier: this.db.prepare(`
        UPDATE memories
        SET storage_tier = ?
        WHERE id = ?
      `),
      
      getStats: this.db.prepare(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN storage_tier = 'hot' THEN 1 ELSE 0 END) as hot,
          SUM(CASE WHEN storage_tier = 'warm' THEN 1 ELSE 0 END) as warm,
          SUM(CASE WHEN storage_tier = 'cold' THEN 1 ELSE 0 END) as cold,
          SUM(size_bytes) as total_bytes,
          AVG(memory_score) as avg_score
        FROM memories
      `)
    };
    
    // Start background tasks
    this.startMaintenanceTasks();
  }
  
  set(key: string, value: any, type: string = 'general', metadata?: MemoryMetadata): void {
    const serialized = JSON.stringify(value);
    const sizeBytes = Buffer.byteLength(serialized);
    const checksum = this.calculateChecksum(serialized);
    
    // Compress large values
    const finalValue = sizeBytes > this.compressionThreshold 
      ? this.compress(serialized)
      : serialized;
    
    this.statements.set.run(
      key,
      finalValue,
      type,
      metadata?.tags?.join(',') || null,
      metadata?.source || 'manual',
      JSON.stringify(metadata?.context || {}),
      checksum,
      sizeBytes
    );
    
    // Update tier based on type
    if (type === 'user_preferences' || type === 'system_critical') {
      this.promoteTier(key, 'hot');
    }
  }
  
  get(key: string): any {
    const result = this.statements.get.get(key) as MemoryRow | undefined;
    
    if (!result) return null;
    
    // Decompress if needed
    const value = result.is_compressed 
      ? this.decompress(result.value)
      : result.value;
    
    return JSON.parse(value);
  }
  
  search(query: string, limit: number = 10): SearchResult[] {
    // Prepare search query for FTS5
    const ftsQuery = this.prepareFtsQuery(query);
    
    const results = this.statements.search.all(ftsQuery, limit) as SearchRow[];
    
    return results.map(row => ({
      key: row.key,
      value: JSON.parse(row.value),
      score: row.rank * row.memory_score,
      type: row.type,
      tags: row.tags?.split(',') || []
    }));
  }
  
  private prepareFtsQuery(query: string): string {
    // Escape special characters and prepare for FTS5
    return query
      .split(/\s+/)
      .map(term => `"${term}"*`) // Prefix search
      .join(' OR ');
  }
  
  private startMaintenanceTasks(): void {
    // Rebalance tiers every hour
    setInterval(() => this.rebalanceTiers(), 3600000);
    
    // Update scores every 15 minutes
    setInterval(() => this.updateMemoryScores(), 900000);
    
    // Compress cold memories daily
    setInterval(() => this.compressColdMemories(), 86400000);
  }
  
  private async rebalanceTiers(): Promise<void> {
    // Move hot memories that haven't been accessed recently to warm
    this.db.prepare(`
      UPDATE memories
      SET storage_tier = 'warm'
      WHERE storage_tier = 'hot'
        AND type NOT IN ('user_preferences', 'system_critical')
        AND julianday('now') - julianday(accessed_at) > 1
        AND memory_score < 0.7
    `).run();
    
    // Promote high-value warm memories to hot
    const hotCount = this.db.prepare(
      'SELECT COUNT(*) as count FROM memories WHERE storage_tier = "hot"'
    ).get().count;
    
    if (hotCount < 250) { // Leave room for new memories
      this.db.prepare(`
        UPDATE memories
        SET storage_tier = 'hot'
        WHERE id IN (
          SELECT id FROM memories
          WHERE storage_tier = 'warm'
            AND memory_score > 0.8
          ORDER BY memory_score DESC
          LIMIT ?
        )
      `).run(250 - hotCount);
    }
    
    // Demote old warm memories to cold
    this.db.prepare(`
      UPDATE memories
      SET storage_tier = 'cold'
      WHERE storage_tier = 'warm'
        AND julianday('now') - julianday(accessed_at) > 30
        AND access_count < 5
    `).run();
  }
}
```

## Sessions Module Detailed Specification

### Schema

```sql
-- Session management with comprehensive tracking
CREATE TABLE sessions (
    id TEXT PRIMARY KEY, -- UUID v4
    user_id TEXT NOT NULL,
    
    -- Temporal
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    
    -- Session data
    data JSON NOT NULL DEFAULT '{}',
    
    -- Context
    initial_context JSON, -- What was loaded on init
    current_project TEXT,
    loaded_memory_count INTEGER DEFAULT 0,
    
    -- Activity tracking
    interaction_count INTEGER DEFAULT 0,
    memory_reads INTEGER DEFAULT 0,
    memory_writes INTEGER DEFAULT 0,
    executions_started INTEGER DEFAULT 0,
    patterns_detected INTEGER DEFAULT 0,
    
    -- State
    is_active BOOLEAN DEFAULT 1,
    terminated_reason TEXT,
    
    -- Performance
    avg_response_time_ms REAL,
    total_tokens_used INTEGER DEFAULT 0
);

CREATE INDEX idx_sessions_active ON sessions(last_accessed DESC) WHERE is_active = 1;
CREATE INDEX idx_sessions_user ON sessions(user_id, started_at DESC);

-- Session events for audit trail
CREATE TABLE session_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT REFERENCES sessions(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    event_data JSON,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_session_events ON session_events(session_id, timestamp DESC);
```

### Implementation

```typescript
export class SessionsModule implements SessionsModuleInterface {
  private activeSessions: Map<string, SessionData> = new Map();
  private statements: PreparedStatements;
  
  initialize(): void {
    this.db.exec(SESSIONS_SCHEMA);
    
    this.statements = {
      create: this.db.prepare(`
        INSERT INTO sessions (id, user_id, expires_at, initial_context)
        VALUES (?, ?, datetime('now', '+24 hours'), ?)
        RETURNING *
      `),
      
      get: this.db.prepare(`
        SELECT * FROM sessions
        WHERE id = ? AND is_active = 1 AND expires_at > datetime('now')
      `),
      
      update: this.db.prepare(`
        UPDATE sessions
        SET data = ?,
            last_accessed = CURRENT_TIMESTAMP,
            interaction_count = interaction_count + 1
        WHERE id = ? AND is_active = 1
      `),
      
      recordEvent: this.db.prepare(`
        INSERT INTO session_events (session_id, event_type, event_data)
        VALUES (?, ?, ?)
      `),
      
      terminate: this.db.prepare(`
        UPDATE sessions
        SET is_active = 0,
            terminated_reason = ?
        WHERE id = ?
      `),
      
      cleanup: this.db.prepare(`
        UPDATE sessions
        SET is_active = 0,
            terminated_reason = 'expired'
        WHERE is_active = 1 AND expires_at < datetime('now')
      `)
    };
    
    // Load active sessions into memory
    this.loadActiveSessions();
    
    // Start cleanup task
    setInterval(() => this.cleanup(), 300000); // Every 5 minutes
  }
  
  create(): string {
    const sessionId = crypto.randomUUID();
    const userId = process.env.USER || 'default';
    
    // Load initial context
    const context = this.loadInitialContext();
    
    // Create in database
    const session = this.statements.create.get(
      sessionId,
      userId,
      JSON.stringify(context)
    ) as SessionRow;
    
    // Cache in memory
    this.activeSessions.set(sessionId, {
      id: sessionId,
      userId,
      startedAt: new Date(session.started_at),
      lastAccessed: new Date(session.last_accessed),
      data: {},
      context,
      stats: {
        interactionCount: 0,
        memoryReads: 0,
        memoryWrites: 0,
        executionsStarted: 0,
        patternsDetected: 0
      }
    });
    
    // Record creation event
    this.recordEvent(sessionId, 'created', { userId, context });
    
    return sessionId;
  }
  
  get(id: string): Session | null {
    // Check memory cache first
    const cached = this.activeSessions.get(id);
    if (cached) {
      this.touchSession(id);
      return this.toSession(cached);
    }
    
    // Check database
    const row = this.statements.get.get(id) as SessionRow | undefined;
    if (!row) return null;
    
    // Load into cache
    const sessionData: SessionData = {
      id: row.id,
      userId: row.user_id,
      startedAt: new Date(row.started_at),
      lastAccessed: new Date(row.last_accessed),
      data: JSON.parse(row.data),
      context: JSON.parse(row.initial_context || '{}'),
      stats: {
        interactionCount: row.interaction_count,
        memoryReads: row.memory_reads,
        memoryWrites: row.memory_writes,
        executionsStarted: row.executions_started,
        patternsDetected: row.patterns_detected
      }
    };
    
    this.activeSessions.set(id, sessionData);
    return this.toSession(sessionData);
  }
  
  update(id: string, data: any): void {
    const session = this.activeSessions.get(id);
    if (!session) {
      throw new Error(`Session ${id} not found`);
    }
    
    // Merge data
    session.data = { ...session.data, ...data };
    session.lastAccessed = new Date();
    
    // Persist to database
    this.statements.update.run(
      JSON.stringify(session.data),
      id
    );
    
    // Record update event
    this.recordEvent(id, 'updated', { changes: Object.keys(data) });
  }
  
  cleanup(): number {
    // Mark expired sessions
    const result = this.statements.cleanup.run();
    
    // Remove from cache
    const now = Date.now();
    let cleaned = 0;
    
    for (const [id, session] of this.activeSessions) {
      const age = now - session.lastAccessed.getTime();
      if (age > 86400000) { // 24 hours
        this.activeSessions.delete(id);
        cleaned++;
      }
    }
    
    return result.changes + cleaned;
  }
  
  private loadInitialContext(): InitialContext {
    // This would interact with other modules
    return {
      preferences: {}, // Would load from memory module
      activeProject: null, // Would detect from projects module
      timestamp: new Date().toISOString()
    };
  }
  
  private recordEvent(sessionId: string, eventType: string, eventData: any): void {
    this.statements.recordEvent.run(
      sessionId,
      eventType,
      JSON.stringify(eventData)
    );
  }
}
```

## Execution Module Detailed Specification

### Schema

```sql
-- Execution queue and history
CREATE TABLE executions (
    id TEXT PRIMARY KEY, -- UUID v4
    session_id TEXT REFERENCES sessions(id),
    
    -- Code details
    code TEXT NOT NULL,
    language TEXT DEFAULT 'python',
    code_hash TEXT NOT NULL, -- SHA256 of code
    
    -- Status tracking
    status TEXT NOT NULL DEFAULT 'queued',
    priority INTEGER DEFAULT 5, -- 1-10, higher = more priority
    
    -- Timing
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    queued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    
    -- Execution details
    worker_id TEXT,
    pid INTEGER,
    exit_code INTEGER,
    
    -- Resource usage
    max_memory_mb REAL,
    cpu_time_ms INTEGER,
    wall_time_ms INTEGER,
    
    -- Output
    output_file TEXT,
    error_file TEXT,
    output_size_bytes INTEGER,
    error_size_bytes INTEGER,
    output_truncated BOOLEAN DEFAULT 0,
    
    -- Error handling
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    error_message TEXT,
    
    -- Metadata
    tags TEXT,
    parent_execution_id TEXT REFERENCES executions(id),
    
    CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled', 'timeout'))
);

-- Indexes for queue management
CREATE INDEX idx_executions_queue ON executions(status, priority DESC, created_at ASC) 
WHERE status = 'queued';

CREATE INDEX idx_executions_session ON executions(session_id, created_at DESC);
CREATE INDEX idx_executions_worker ON executions(worker_id, status) 
WHERE status = 'running';

-- Execution artifacts (for large outputs)
CREATE TABLE execution_artifacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    execution_id TEXT REFERENCES executions(id) ON DELETE CASCADE,
    artifact_type TEXT NOT NULL, -- 'stdout', 'stderr', 'file', 'plot', etc.
    path TEXT NOT NULL,
    size_bytes INTEGER,
    mime_type TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Implementation

```typescript
export class ExecutionModule implements ExecutionModuleInterface {
  private statements: PreparedStatements;
  private outputDir = './data/executions';
  
  initialize(): void {
    this.db.exec(EXECUTIONS_SCHEMA);
    
    // Ensure output directory exists
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
    
    this.statements = {
      queue: this.db.prepare(`
        INSERT INTO executions (
          id, session_id, code, language, code_hash, priority
        ) VALUES (?, ?, ?, ?, ?, ?)
        RETURNING id, status
      `),
      
      claim: this.db.prepare(`
        UPDATE executions
        SET status = 'running',
            started_at = CURRENT_TIMESTAMP,
            worker_id = ?,
            pid = ?
        WHERE id = (
          SELECT id FROM executions
          WHERE status = 'queued'
            AND retry_count < max_retries
          ORDER BY priority DESC, created_at ASC
          LIMIT 1
        )
        RETURNING *
      `),
      
      complete: this.db.prepare(`
        UPDATE executions
        SET status = ?,
            completed_at = CURRENT_TIMESTAMP,
            exit_code = ?,
            output_file = ?,
            error_file = ?,
            output_size_bytes = ?,
            error_size_bytes = ?,
            max_memory_mb = ?,
            cpu_time_ms = ?,
            wall_time_ms = ?,
            error_message = ?
        WHERE id = ?
      `),
      
      getStatus: this.db.prepare(`
        SELECT 
          id, status, created_at, started_at, completed_at,
          exit_code, error_message, worker_id,
          output_size_bytes, error_size_bytes
        FROM executions
        WHERE id = ?
      `),
      
      getOutput: this.db.prepare(`
        SELECT output_file, error_file, output_truncated
        FROM executions
        WHERE id = ? AND status = 'completed'
      `),
      
      listRecent: this.db.prepare(`
        SELECT 
          id, status, language, created_at,
          SUBSTR(code, 1, 100) as code_preview,
          exit_code, error_message
        FROM executions
        WHERE session_id = ?
        ORDER BY created_at DESC
        LIMIT ?
      `),
      
      cancelStale: this.db.prepare(`
        UPDATE executions
        SET status = 'timeout',
            error_message = 'Execution timeout',
            completed_at = CURRENT_TIMESTAMP
        WHERE status = 'running'
          AND julianday('now') - julianday(started_at) > ?
      `)
    };
    
    // Start maintenance tasks
    setInterval(() => this.cleanupStale(), 60000); // Every minute
  }
  
  queue(code: string, language: string = 'python'): { executionId: string; status: 'queued' } {
    const executionId = crypto.randomUUID();
    const sessionId = this.getCurrentSessionId(); // From context
    const codeHash = this.hashCode(code);
    
    // Determine priority based on code characteristics
    const priority = this.calculatePriority(code, language);
    
    const result = this.statements.queue.get(
      executionId,
      sessionId,
      code,
      language,
      codeHash,
      priority
    );
    
    return {
      executionId,
      status: 'queued'
    };
  }
  
  getStatus(executionId: string): ExecutionStatus {
    const row = this.statements.getStatus.get(executionId) as ExecutionRow;
    
    if (!row) {
      throw new Error(`Execution ${executionId} not found`);
    }
    
    return {
      id: row.id,
      status: row.status as any,
      created_at: row.created_at,
      started_at: row.started_at,
      completed_at: row.completed_at,
      exit_code: row.exit_code,
      error_message: row.error_message,
      output_size: row.output_size_bytes,
      error_size: row.error_size_bytes
    };
  }
  
  getOutput(executionId: string): { stdout: string; stderr: string } | null {
    const row = this.statements.getOutput.get(executionId) as OutputRow;
    
    if (!row) return null;
    
    try {
      const stdout = row.output_file 
        ? fs.readFileSync(row.output_file, 'utf8')
        : '';
      
      const stderr = row.error_file
        ? fs.readFileSync(row.error_file, 'utf8')
        : '';
      
      return {
        stdout: row.output_truncated ? stdout + '\n[Output truncated]' : stdout,
        stderr
      };
    } catch (error) {
      console.error(`Failed to read output files for ${executionId}:`, error);
      return null;
    }
  }
  
  // Internal method used by worker
  claimJob(workerId: string, pid: number): ExecutionJob | null {
    const row = this.statements.claim.get(workerId, pid) as ExecutionRow;
    return row ? this.rowToJob(row) : null;
  }
  
  // Internal method used by worker
  completeJob(
    executionId: string,
    result: ExecutionResult
  ): void {
    this.statements.complete.run(
      result.success ? 'completed' : 'failed',
      result.exitCode,
      result.outputFile,
      result.errorFile,
      result.outputSize,
      result.errorSize,
      result.maxMemoryMb,
      result.cpuTimeMs,
      result.wallTimeMs,
      result.errorMessage,
      executionId
    );
  }
  
  private calculatePriority(code: string, language: string): number {
    let priority = 5; // Default
    
    // Higher priority for shorter code (likely interactive)
    if (code.length < 100) priority += 2;
    
    // Lower priority for obvious long-running operations
    if (code.includes('sleep(') || code.includes('time.sleep')) priority -= 2;
    if (code.includes('for') && code.includes('range(10000')) priority -= 1;
    
    // Higher priority for data exploration
    if (code.includes('print(') || code.includes('.head()')) priority += 1;
    
    return Math.max(1, Math.min(10, priority));
  }
  
  private cleanupStale(): void {
    // Cancel executions that have been running too long
    const timeout = 300; // 5 minutes in seconds
    this.statements.cancelStale.run(timeout / 86400); // Convert to Julian days
    
    // Clean up old output files
    const cutoff = Date.now() - 7 * 86400000; // 7 days
    
    fs.readdirSync(this.outputDir).forEach(file => {
      const filePath = path.join(this.outputDir, file);
      const stats = fs.statSync(filePath);
      
      if (stats.mtimeMs < cutoff) {
        fs.unlinkSync(filePath);
      }
    });
  }
}
```

## Notes Module Detailed Specification

### Schema

```sql
-- Notes with dual storage (DB + filesystem)
CREATE TABLE notes (
    id TEXT PRIMARY KEY, -- UUID v4
    session_id TEXT REFERENCES sessions(id),
    
    -- Content
    title TEXT,
    content TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    format TEXT DEFAULT 'markdown', -- markdown, plain, json
    
    -- Organization
    project TEXT,
    category TEXT,
    tags TEXT, -- Comma-separated
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- File sync
    file_path TEXT,
    sync_status TEXT DEFAULT 'synced', -- synced, pending, conflict
    last_synced_at TIMESTAMP,
    
    -- Metadata
    word_count INTEGER,
    char_count INTEGER,
    
    -- Relations
    parent_note_id TEXT REFERENCES notes(id),
    related_notes TEXT, -- Comma-separated IDs
    
    -- Flags
    is_archived BOOLEAN DEFAULT 0,
    is_pinned BOOLEAN DEFAULT 0,
    is_encrypted BOOLEAN DEFAULT 0
);

CREATE INDEX idx_notes_project ON notes(project, created_at DESC);
CREATE INDEX idx_notes_tags ON notes(tags) WHERE tags IS NOT NULL;
CREATE INDEX idx_notes_sync ON notes(sync_status) WHERE sync_status != 'synced';

-- Full-text search for notes
CREATE VIRTUAL TABLE notes_fts USING fts5(
    title,
    content,
    tags,
    content=notes,
    tokenize='unicode61 remove_diacritics 2'
);

-- Note versions for history
CREATE TABLE note_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    note_id TEXT REFERENCES notes(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    content TEXT NOT NULL,
    title TEXT,
    change_summary TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT,
    diff_size INTEGER, -- Size of diff from previous version
    UNIQUE(note_id, version_number)
);

CREATE INDEX idx_note_versions ON note_versions(note_id, version_number DESC);
```

### Implementation

```typescript
export class NotesModule implements NotesModuleInterface {
  private statements: PreparedStatements;
  private notesDir = './notes';
  private syncInterval = 300000; // 5 minutes
  
  initialize(): void {
    this.db.exec(NOTES_SCHEMA);
    
    // Ensure notes directory exists
    if (!fs.existsSync(this.notesDir)) {
      fs.mkdirSync(this.notesDir, { recursive: true });
    }
    
    this.statements = {
      create: this.db.prepare(`
        INSERT INTO notes (
          id, session_id, title, content, content_hash,
          project, category, tags, word_count, char_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING *
      `),
      
      get: this.db.prepare(`
        SELECT * FROM notes
        WHERE id = ? AND is_archived = 0
      `),
      
      update: this.db.prepare(`
        UPDATE notes
        SET title = ?,
            content = ?,
            content_hash = ?,
            tags = ?,
            updated_at = CURRENT_TIMESTAMP,
            sync_status = 'pending',
            word_count = ?,
            char_count = ?
        WHERE id = ?
      `),
      
      search: this.db.prepare(`
        SELECT 
          n.*,
          snippet(notes_fts, 1, '<mark>', '</mark>', '...', 32) as snippet,
          rank
        FROM notes n
        JOIN notes_fts f ON n.id = f.rowid
        WHERE notes_fts MATCH ?
          AND n.is_archived = 0
          AND (? IS NULL OR n.project = ?)
          AND (? IS NULL OR n.tags LIKE ?)
          AND (? IS NULL OR julianday('now') - julianday(n.created_at) <= ?)
        ORDER BY rank DESC
        LIMIT ?
      `),
      
      saveVersion: this.db.prepare(`
        INSERT INTO note_versions (
          note_id, version_number, content, title, change_summary, diff_size
        ) VALUES (?, ?, ?, ?, ?, ?)
      `),
      
      syncToFile: this.db.prepare(`
        UPDATE notes
        SET file_path = ?,
            sync_status = 'synced',
            last_synced_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `),
      
      listUnsyncedNotes: this.db.prepare(`
        SELECT id, title, content, project, file_path
        FROM notes
        WHERE sync_status = 'pending'
        LIMIT 100
      `)
    };
    
    // Start sync task
    setInterval(() => this.syncNotes(), this.syncInterval);
    
    // Initial sync
    this.syncNotes();
  }
  
  create(content: string, title?: string, tags?: string[]): Note {
    const noteId = crypto.randomUUID();
    const sessionId = this.getCurrentSessionId();
    const project = this.detectProject();
    
    // Calculate metadata
    const wordCount = content.split(/\s+/).length;
    const charCount = content.length;
    const contentHash = this.hashContent(content);
    
    // Create in database
    const note = this.statements.create.get(
      noteId,
      sessionId,
      title || this.generateTitle(content),
      content,
      contentHash,
      project,
      this.inferCategory(content, tags),
      tags?.join(',') || null,
      wordCount,
      charCount
    ) as NoteRow;
    
    // Save initial version
    this.saveVersion(noteId, 1, content, title, 'Initial creation');
    
    // Schedule sync
    this.scheduleSyncNote(noteId);
    
    return this.rowToNote(note);
  }
  
  get(id: string): Note | null {
    const row = this.statements.get.get(id) as NoteRow;
    return row ? this.rowToNote(row) : null;
  }
  
  search(query: string, filters?: NoteFilters): Note[] {
    const ftsQuery = this.prepareFtsQuery(query);
    
    const results = this.statements.search.all(
      ftsQuery,
      filters?.project || null,
      filters?.project || null,
      filters?.tags ? `%${filters.tags.join('%')}%` : null,
      filters?.tags ? `%${filters.tags.join('%')}%` : null,
      filters?.days || null,
      filters?.days || null,
      filters?.limit || 20
    ) as NoteSearchRow[];
    
    return results.map(row => ({
      ...this.rowToNote(row),
      snippet: row.snippet
    }));
  }
  
  update(id: string, updates: Partial<Note>): void {
    const existing = this.get(id);
    if (!existing) {
      throw new Error(`Note ${id} not found`);
    }
    
    // Merge updates
    const updated = {
      ...existing,
      ...updates,
      content: updates.content || existing.content
    };
    
    // Calculate new metadata
    const wordCount = updated.content.split(/\s+/).length;
    const charCount = updated.content.length;
    const contentHash = this.hashContent(updated.content);
    
    // Get current version number
    const currentVersion = this.getCurrentVersion(id);
    
    // Save new version if content changed
    if (contentHash !== existing.content_hash) {
      this.saveVersion(
        id,
        currentVersion + 1,
        updated.content,
        updated.title,
        this.generateChangeSummary(existing.content, updated.content)
      );
    }
    
    // Update database
    this.statements.update.run(
      updated.title,
      updated.content,
      contentHash,
      updated.tags?.join(',') || null,
      wordCount,
      charCount,
      id
    );
  }
  
  private async syncNotes(): Promise<void> {
    const unsynced = this.statements.listUnsyncedNotes.all() as UnsyncedNote[];
    
    for (const note of unsynced) {
      try {
        const filePath = await this.syncNoteToFile(note);
        this.statements.syncToFile.run(filePath, note.id);
      } catch (error) {
        console.error(`Failed to sync note ${note.id}:`, error);
      }
    }
  }
  
  private async syncNoteToFile(note: UnsyncedNote): Promise<string> {
    // Create directory structure
    const projectDir = path.join(this.notesDir, note.project || 'general');
    if (!fs.existsSync(projectDir)) {
      fs.mkdirSync(projectDir, { recursive: true });
    }
    
    // Generate filename
    const safeTitle = this.sanitizeFilename(note.title || 'untitled');
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `${timestamp}-${safeTitle}.md`;
    const filePath = path.join(projectDir, filename);
    
    // Write content with frontmatter
    const frontmatter = {
      id: note.id,
      title: note.title,
      created: new Date().toISOString(),
      tags: note.tags?.split(',') || []
    };
    
    const fileContent = `---
${Object.entries(frontmatter).map(([k, v]) => 
      `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`
    ).join('\n')}
---

${note.content}`;
    
    fs.writeFileSync(filePath, fileContent, 'utf8');
    
    return filePath;
  }
  
  private generateTitle(content: string): string {
    // Extract first line or first sentence
    const firstLine = content.split('\n')[0].trim();
    const firstSentence = content.split(/[.!?]/)[0].trim();
    
    const title = (firstLine.length < 50 ? firstLine : firstSentence).slice(0, 50);
    
    return title || 'Untitled Note';
  }
  
  private inferCategory(content: string, tags?: string[]): string {
    // Simple category inference based on content and tags
    const categories = {
      'code': /```|function|class|import|const|let|var/i,
      'meeting': /meeting|agenda|action items|attendees/i,
      'idea': /idea|concept|thought|proposal|suggestion/i,
      'documentation': /overview|guide|tutorial|explanation/i,
      'task': /todo|task|checklist|\[\s*\]|\[x\]/i
    };
    
    for (const [category, pattern] of Object.entries(categories)) {
      if (pattern.test(content) || tags?.some(tag => tag.toLowerCase().includes(category))) {
        return category;
      }
    }
    
    return 'general';
  }
  
  private generateChangeSummary(oldContent: string, newContent: string): string {
    const oldLines = oldContent.split('\n').length;
    const newLines = newContent.split('\n').length;
    const linesDiff = newLines - oldLines;
    
    const oldWords = oldContent.split(/\s+/).length;
    const newWords = newContent.split(/\s+/).length;
    const wordsDiff = newWords - oldWords;
    
    if (linesDiff > 0) {
      return `Added ${linesDiff} lines, ${wordsDiff} words`;
    } else if (linesDiff < 0) {
      return `Removed ${Math.abs(linesDiff)} lines, ${Math.abs(wordsDiff)} words`;
    } else {
      return `Modified content (${wordsDiff > 0 ? '+' : ''}${wordsDiff} words)`;
    }
  }
}
```

## Projects Module Detailed Specification

### Schema

```sql
-- Central project index
CREATE TABLE central_index (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project TEXT NOT NULL,
    path TEXT NOT NULL,
    
    -- File metadata
    name TEXT NOT NULL,
    extension TEXT,
    size INTEGER,
    last_modified DATETIME,
    
    -- Content classification
    category TEXT, -- docs, code, config, data, etc.
    purpose TEXT, -- description of file's purpose
    importance REAL DEFAULT 0.5, -- 0-1 score
    
    -- Discovery metadata
    first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    scan_count INTEGER DEFAULT 1,
    
    -- Status
    status TEXT DEFAULT 'active', -- active, orphaned, deleted
    is_tracked BOOLEAN DEFAULT 1,
    
    -- Content analysis
    language TEXT, -- For code files
    framework TEXT, -- Detected framework
    dependencies TEXT, -- Comma-separated
    
    -- Relationships
    imports TEXT, -- Files this imports/requires
    imported_by TEXT, -- Files that import this
    
    UNIQUE(project, path)
);

CREATE INDEX idx_central_index_project ON central_index(project, category, status);
CREATE INDEX idx_central_index_importance ON central_index(importance DESC, last_seen DESC);
CREATE INDEX idx_central_index_modified ON central_index(last_modified DESC);

-- Project metadata
CREATE TABLE project_metadata (
    project TEXT PRIMARY KEY,
    root_path TEXT NOT NULL,
    
    -- Detection
    detected_type TEXT, -- python, node, rust, etc.
    detected_frameworks TEXT, -- Comma-separated
    
    -- Statistics
    total_files INTEGER DEFAULT 0,
    total_size_bytes INTEGER DEFAULT 0,
    last_indexed DATETIME,
    index_duration_ms INTEGER,
    
    -- Configuration
    ignore_patterns TEXT, -- Comma-separated glob patterns
    priority_patterns TEXT, -- Files to prioritize
    
    -- Health
    health_score REAL DEFAULT 1.0, -- 0-1
    issues_detected TEXT -- JSON array of issues
);

-- File relationships graph
CREATE TABLE file_relationships (
    from_file_id INTEGER REFERENCES central_index(id),
    to_file_id INTEGER REFERENCES central_index(id),
    relationship_type TEXT, -- imports, references, generates, tests
    confidence REAL DEFAULT 1.0,
    
    PRIMARY KEY (from_file_id, to_file_id, relationship_type)
);
```

### Implementation

```typescript
export class ProjectsModule implements ProjectsModuleInterface {
  private statements: PreparedStatements;
  private fileWatchers: Map<string, FSWatcher> = new Map();
  private indexQueue: Set<string> = new Set();
  
  initialize(): void {
    this.db.exec(PROJECTS_SCHEMA);
    
    this.statements = {
      upsertFile: this.db.prepare(`
        INSERT INTO central_index (
          project, path, name, extension, size, last_modified,
          category, purpose, language, framework
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(project, path) DO UPDATE SET
          size = excluded.size,
          last_modified = excluded.last_modified,
          last_seen = CURRENT_TIMESTAMP,
          scan_count = scan_count + 1,
          status = 'active'
      `),
      
      markOrphaned: this.db.prepare(`
        UPDATE central_index
        SET status = 'orphaned'
        WHERE project = ?
          AND last_seen < ?
          AND status = 'active'
      `),
      
      getDocuments: this.db.prepare(`
        SELECT path, category, purpose, importance, last_modified
        FROM central_index
        WHERE project = ?
          AND status = 'active'
          AND (? IS NULL OR category = ?)
        ORDER BY importance DESC, last_modified DESC
      `),
      
      updateProjectStats: this.db.prepare(`
        INSERT INTO project_metadata (project, root_path)
        VALUES (?, ?)
        ON CONFLICT(project) DO UPDATE SET
          total_files = (
            SELECT COUNT(*) FROM central_index 
            WHERE project = ? AND status = 'active'
          ),
          total_size_bytes = (
            SELECT SUM(size) FROM central_index 
            WHERE project = ? AND status = 'active'
          ),
          last_indexed = CURRENT_TIMESTAMP
      `),
      
      detectProject: this.db.prepare(`
        SELECT project, root_path 
        FROM project_metadata
        WHERE root_path LIKE ?
        ORDER BY LENGTH(root_path) DESC
        LIMIT 1
      `),
      
      getProjectHealth: this.db.prepare(`
        SELECT 
          COUNT(CASE WHEN status = 'orphaned' THEN 1 END) as orphaned_count,
          COUNT(CASE WHEN last_modified < datetime('now', '-90 days') THEN 1 END) as stale_count,
          COUNT(*) as total_count
        FROM central_index
        WHERE project = ?
      `)
    };
    
    // Start background indexing
    setInterval(() => this.processIndexQueue(), 5000);
  }
  
  updateIndex(projectPath: string): IndexResult {
    const startTime = Date.now();
    const projectName = path.basename(projectPath);
    
    // Mark scan start time
    const scanStartTime = new Date().toISOString();
    
    // Scan directory recursively
    const files = this.scanDirectory(projectPath);
    let indexed = 0;
    
    for (const file of files) {
      if (this.shouldIndex(file)) {
        this.indexFile(projectName, projectPath, file);
        indexed++;
      }
    }
    
    // Mark files not seen in this scan as orphaned
    const orphaned = this.statements.markOrphaned.run(
      projectName,
      scanStartTime
    ).changes;
    
    // Update project metadata
    this.statements.updateProjectStats.run(
      projectName,
      projectPath,
      projectName,
      projectName
    );
    
    // Set up file watcher if not already watching
    if (!this.fileWatchers.has(projectPath)) {
      this.watchProject(projectPath);
    }
    
    return {
      success: true,
      files_indexed: indexed,
      files_orphaned: orphaned,
      duration_ms: Date.now() - startTime
    };
  }
  
  checkIndex(projectPath: string): HealthCheck {
    const projectName = path.basename(projectPath);
    const stats = this.statements.getProjectHealth.get(projectName);
    
    const issues = {
      orphaned: [],
      missing: [],
      stale: []
    };
    
    // Find orphaned files
    if (stats.orphaned_count > 0) {
      const orphaned = this.db.prepare(`
        SELECT path FROM central_index
        WHERE project = ? AND status = 'orphaned'
      `).all(projectName);
      issues.orphaned = orphaned.map(r => r.path);
    }
    
    // Check for missing important files
    const importantFiles = ['README.md', 'package.json', 'requirements.txt'];
    for (const file of importantFiles) {
      const fullPath = path.join(projectPath, file);
      if (fs.existsSync(fullPath)) {
        const indexed = this.db.prepare(`
          SELECT 1 FROM central_index
          WHERE project = ? AND path = ?
        `).get(projectName, file);
        
        if (!indexed) {
          issues.missing.push(file);
        }
      }
    }
    
    // Find stale files
    if (stats.stale_count > 0) {
      const stale = this.db.prepare(`
        SELECT path FROM central_index
        WHERE project = ?
          AND status = 'active'
          AND last_modified < datetime('now', '-90 days')
      `).all(projectName);
      issues.stale = stale.map(r => r.path);
    }
    
    const healthy = issues.orphaned.length === 0 && 
                   issues.missing.length === 0 && 
                   issues.stale.length < stats.total_count * 0.1;
    
    return { healthy, issues };
  }
  
  getDocuments(projectPath: string, category?: string): Document[] {
    const projectName = path.basename(projectPath);
    
    const results = this.statements.getDocuments.all(
      projectName,
      category || null,
      category || null
    ) as DocumentRow[];
    
    return results.map(row => ({
      path: row.path,
      category: row.category,
      purpose: row.purpose || this.inferPurpose(row.path, row.category),
      last_modified: row.last_modified,
      importance: row.importance
    }));
  }
  
  detectProject(): string | null {
    const cwd = process.cwd();
    
    // Check if we're in a known project
    const result = this.statements.detectProject.get(`${cwd}%`);
    
    if (result) {
      return result.project;
    }
    
    // Try to detect based on project files
    const projectFiles = {
      'package.json': 'node',
      'Cargo.toml': 'rust',
      'requirements.txt': 'python',
      'pyproject.toml': 'python',
      'go.mod': 'go'
    };
    
    for (const [file, type] of Object.entries(projectFiles)) {
      if (fs.existsSync(path.join(cwd, file))) {
        // Index this new project
        this.updateIndex(cwd);
        return path.basename(cwd);
      }
    }
    
    return null;
  }
  
  private indexFile(project: string, rootPath: string, filePath: string): void {
    const relativePath = path.relative(rootPath, filePath);
    const stats = fs.statSync(filePath);
    const parsed = path.parse(filePath);
    
    // Analyze file
    const analysis = this.analyzeFile(filePath);
    
    this.statements.upsertFile.run(
      project,
      relativePath,
      parsed.base,
      parsed.ext,
      stats.size,
      stats.mtime.toISOString(),
      analysis.category,
      analysis.purpose,
      analysis.language,
      analysis.framework
    );
    
    // Extract relationships if it's a code file
    if (analysis.category === 'code') {
      this.extractRelationships(project, relativePath, filePath);
    }
  }
  
  private analyzeFile(filePath: string): FileAnalysis {
    const ext = path.extname(filePath).toLowerCase();
    const basename = path.basename(filePath);
    const content = this.readFileHead(filePath, 1000); // First 1KB
    
    // Detect category
    const category = this.detectCategory(ext, basename, content);
    
    // Detect language for code files
    const language = category === 'code' ? this.detectLanguage(ext, content) : null;
    
    // Detect framework
    const framework = this.detectFramework(content, language);
    
    // Infer purpose
    const purpose = this.inferPurpose(filePath, category);
    
    return { category, language, framework, purpose };
  }
  
  private detectCategory(ext: string, basename: string, content: string): string {
    // Configuration files
    if (['.json', '.yaml', '.yml', '.toml', '.ini', '.env'].includes(ext) ||
        ['Makefile', 'Dockerfile', '.gitignore'].includes(basename)) {
      return 'config';
    }
    
    // Documentation
    if (['.md', '.txt', '.rst', '.adoc'].includes(ext) ||
        basename.match(/README|LICENSE|CHANGELOG/i)) {
      return 'docs';
    }
    
    // Code files
    if (['.js', '.ts', '.py', '.rs', '.go', '.java', '.cpp', '.c'].includes(ext)) {
      return 'code';
    }
    
    // Data files
    if (['.csv', '.json', '.xml', '.sql'].includes(ext)) {
      return 'data';
    }
    
    // Test files
    if (basename.match(/test|spec/i) || content.includes('describe(') || content.includes('test(')) {
      return 'test';
    }
    
    return 'other';
  }
  
  private watchProject(projectPath: string): void {
    const watcher = fs.watch(projectPath, { recursive: true }, (event, filename) => {
      if (filename && this.shouldIndex(path.join(projectPath, filename))) {
        this.indexQueue.add(path.join(projectPath, filename));
      }
    });
    
    this.fileWatchers.set(projectPath, watcher);
  }
  
  private shouldIndex(filePath: string): boolean {
    const basename = path.basename(filePath);
    
    // Skip hidden files and directories
    if (basename.startsWith('.')) return false;
    
    // Skip node_modules, venv, etc.
    const ignoreDirs = ['node_modules', 'venv', 'env', '__pycache__', 'dist', 'build'];
    if (ignoreDirs.some(dir => filePath.includes(dir))) return false;
    
    // Skip binary files
    const binaryExts = ['.jpg', '.png', '.gif', '.pdf', '.zip', '.exe', '.dll'];
    if (binaryExts.some(ext => filePath.endsWith(ext))) return false;
    
    return true;
  }
}
```
