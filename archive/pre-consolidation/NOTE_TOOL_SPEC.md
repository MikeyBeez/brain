# Brain Note Tool Specification

## Overview

The `brain:note` tool provides quick capture of thoughts, ideas, and observations with automatic dual storage - both in Brain's database and as markdown files in the project.

## Philosophy

"Write once, store twice" - No choosing where to put notes. Short notes automatically go to both the database (for search) and files (for version control).

## Tool Interface

```bash
brain:note "Quick thought about session handling"
brain:note --title="Architecture Decision" "We should use SQLite because..."
brain:note --tag=todo "Need to implement error handling"
```

## Internal Implementation

```typescript
interface NoteParams {
  content: string;
  title?: string;
  tags?: string[];
}

interface NoteResult {
  success: boolean;
  message: string;
  locations: {
    database: boolean;
    file: string | null;
  };
  id: string;
}

export class BrainNoteTool implements Tool {
  name = 'brain:note';
  description = 'Capture quick notes with automatic dual storage';
  
  private db: Database.Database;
  
  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.initializeSchema();
  }
  
  private initializeSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project TEXT,
        content TEXT NOT NULL,
        title TEXT,
        tags TEXT, -- JSON array
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        file_path TEXT,
        sync_status TEXT DEFAULT 'synced' -- synced, file_only, db_only
      );
      
      CREATE INDEX IF NOT EXISTS idx_notes_project ON notes(project);
      CREATE INDEX IF NOT EXISTS idx_notes_created ON notes(created_at);
      CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
        content, title, content=notes, content_rowid=id
      );
    `);
  }
  
  async execute(params: NoteParams): Promise<NoteResult> {
    const timestamp = new Date();
    const project = await this.detectCurrentProject();
    const noteId = this.generateNoteId();
    
    // Determine if note should be written to file
    const shouldWriteFile = project && params.content.length < 1000;
    
    let filePath: string | null = null;
    
    // 1. Write to file if applicable
    if (shouldWriteFile) {
      filePath = await this.writeNoteToFile(
        project!, 
        params.content, 
        params.title, 
        params.tags,
        timestamp
      );
    }
    
    // 2. Always write to database
    const dbResult = this.writeNoteToDatabase({
      id: noteId,
      project,
      content: params.content,
      title: params.title,
      tags: params.tags,
      filePath,
      timestamp
    });
    
    // 3. Return result
    return {
      success: true,
      message: this.buildSuccessMessage(project, filePath, params.title),
      locations: {
        database: true,
        file: filePath
      },
      id: noteId
    };
  }
  
  private async writeNoteToFile(
    projectPath: string,
    content: string,
    title?: string,
    tags?: string[],
    timestamp?: Date
  ): Promise<string> {
    const date = (timestamp || new Date()).toISOString().split('T')[0];
    
    // Generate filename
    const filename = title 
      ? `${date}-${this.slugify(title)}.md`
      : `${date}-note-${this.generateShortId()}.md`;
    
    // Ensure notes directory exists
    const notesDir = path.join(projectPath, 'notes');
    await fs.mkdir(notesDir, { recursive: true });
    
    // Build file content
    const fileContent = this.buildFileContent(content, title, tags, timestamp);
    
    // Write file
    const filePath = path.join(notesDir, filename);
    await fs.writeFile(filePath, fileContent, 'utf-8');
    
    return path.relative(projectPath, filePath);
  }
  
  private writeNoteToDatabase(params: {
    id: string;
    project: string | null;
    content: string;
    title?: string;
    tags?: string[];
    filePath: string | null;
    timestamp: Date;
  }): void {
    const stmt = this.db.prepare(`
      INSERT INTO notes (id, project, content, title, tags, created_at, file_path)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      params.id,
      params.project,
      params.content,
      params.title || null,
      params.tags ? JSON.stringify(params.tags) : null,
      params.timestamp.toISOString(),
      params.filePath
    );
    
    // Update FTS index
    this.db.run(
      'INSERT INTO notes_fts (rowid, content, title) VALUES (last_insert_rowid(), ?, ?)',
      params.content,
      params.title || ''
    );
  }
  
  private buildFileContent(
    content: string,
    title?: string,
    tags?: string[],
    timestamp?: Date
  ): string {
    const parts: string[] = [];
    
    // Title
    parts.push(`# ${title || 'Note'}`);
    parts.push('');
    
    // Tags if present
    if (tags && tags.length > 0) {
      parts.push(`Tags: ${tags.map(t => `#${t}`).join(' ')}`);
      parts.push('');
    }
    
    // Content
    parts.push(content);
    parts.push('');
    
    // Metadata
    parts.push('---');
    parts.push(`Captured: ${(timestamp || new Date()).toISOString()}`);
    
    return parts.join('\n');
  }
  
  private buildSuccessMessage(
    project: string | null,
    filePath: string | null,
    title?: string
  ): string {
    const what = title ? `"${title}"` : 'Note';
    
    if (project && filePath) {
      return `${what} saved to database and ${filePath}`;
    } else if (project) {
      return `${what} saved to database (too long for file)`;
    } else {
      return `${what} saved to database (no project context)`;
    }
  }
  
  private async detectCurrentProject(): Promise<string | null> {
    // In real implementation, this would:
    // 1. Check session context
    // 2. Look for project markers (.git, package.json, etc)
    // 3. Return project root path or null
    return process.cwd();
  }
  
  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50);
  }
  
  private generateNoteId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
  }
  
  private generateShortId(): string {
    return Math.random().toString(36).substring(2, 8);
  }
}

// Additional tool for working with notes
export class BrainRecallNotesTool implements Tool {
  name = 'brain:notes';
  description = 'Search and manage notes';
  
  private db: Database.Database;
  
  constructor(dbPath: string) {
    this.db = new Database(dbPath);
  }
  
  async execute(params: {
    search?: string;
    project?: string;
    tags?: string[];
    days?: number;
    operation?: 'list' | 'sync' | 'clean';
  }): Promise<any> {
    if (params.operation === 'sync') {
      return this.syncNotes();
    }
    
    if (params.operation === 'clean') {
      return this.cleanOrphanedNotes();
    }
    
    // Default: search notes
    return this.searchNotes(params);
  }
  
  private async searchNotes(params: {
    search?: string;
    project?: string;
    tags?: string[];
    days?: number;
  }) {
    let query = 'SELECT * FROM notes WHERE 1=1';
    const queryParams: any[] = [];
    
    if (params.search) {
      query = `
        SELECT n.* FROM notes n
        JOIN notes_fts ON n.id = notes_fts.rowid
        WHERE notes_fts MATCH ?
      `;
      queryParams.push(params.search);
      
      if (params.project) {
        query += ' AND n.project = ?';
        queryParams.push(params.project);
      }
    } else {
      if (params.project) {
        query += ' AND project = ?';
        queryParams.push(params.project);
      }
    }
    
    if (params.days) {
      query += ' AND created_at > datetime("now", "-" || ? || " days")';
      queryParams.push(params.days);
    }
    
    if (params.tags && params.tags.length > 0) {
      // JSON search for tags
      const tagConditions = params.tags.map(() => 'tags LIKE ?').join(' OR ');
      query += ` AND (${tagConditions})`;
      params.tags.forEach(tag => queryParams.push(`%"${tag}"%`));
    }
    
    query += ' ORDER BY created_at DESC LIMIT 50';
    
    const notes = this.db.prepare(query).all(...queryParams);
    
    return {
      success: true,
      count: notes.length,
      notes: notes.map(n => ({
        ...n,
        tags: n.tags ? JSON.parse(n.tags) : []
      }))
    };
  }
  
  private async syncNotes(): Promise<any> {
    // Find notes that exist in DB but not in files, or vice versa
    // Reconcile differences
    // This would be implemented based on your specific needs
    return {
      success: true,
      message: 'Note sync not yet implemented'
    };
  }
  
  private async cleanOrphanedNotes(): Promise<any> {
    // Remove notes from DB where file no longer exists
    // Mark notes as db_only if file was deleted
    return {
      success: true,
      message: 'Note cleanup not yet implemented'
    };
  }
}
```

## Database Schema

```sql
-- Notes table with full-text search
CREATE TABLE notes (
  id TEXT PRIMARY KEY,
  project TEXT,              -- Project path, null if no project context
  content TEXT NOT NULL,     -- The actual note
  title TEXT,               -- Optional title
  tags TEXT,                -- JSON array of tags
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  file_path TEXT,           -- Relative path to file if written
  sync_status TEXT DEFAULT 'synced' -- synced, file_only, db_only
);

-- Full-text search
CREATE VIRTUAL TABLE notes_fts USING fts5(
  content, 
  title, 
  content=notes, 
  content_rowid=id
);
```

## Usage Examples

### Quick capture
```bash
# Simple note - goes to both DB and notes/2025-01-15-note-a4x9k2.md
brain:note "Just realized we need to handle connection drops in session manager"

# Note with title - creates notes/2025-01-15-session-reconnection.md
brain:note --title="Session Reconnection" "Need to implement exponential backoff"

# Tagged note
brain:note --tag=bug --tag=priority "Memory leak in recall tool when searching large datasets"
```

### Searching notes
```bash
# Find all notes about sessions
brain:notes --search="session"

# Recent notes in current project
brain:notes --days=7

# Notes with specific tags
brain:notes --tags=todo,priority

# Combination
brain:notes --search="memory leak" --tags=bug --days=30
```

## File Organization

```
project/
├── notes/
│   ├── 2025-01-15-session-reconnection.md
│   ├── 2025-01-15-note-x7k2p9.md
│   ├── 2025-01-16-memory-leak-investigation.md
│   └── ... (chronological, easy to browse)
```

## Key Features

1. **Dual Storage**: Database for search, files for version control
2. **Auto-organization**: Date-based filenames, automatic directory creation
3. **Full-text Search**: SQLite FTS5 for fast searching
4. **Tags**: Optional tagging for categorization
5. **Size Threshold**: Long notes (>1000 chars) go to database only
6. **Project Awareness**: Notes associated with current project
7. **Git Friendly**: Markdown files with clear names and dates

## Integration with Brain

```typescript
// During brain:init
const recentNotes = await brain.notes({ days: 7, project: currentProject });
if (recentNotes.count > 0) {
  context.recentNotes = recentNotes.notes;
  context.suggestions.push(`You have ${recentNotes.count} recent notes`);
}

// During brain:recall
// Notes are automatically included in search results
```

## Benefits

1. **No Decision Fatigue**: Just write, storage is handled
2. **Version Control**: See when and why decisions were made
3. **Fast Search**: Database queries across all notes
4. **Team Friendly**: Notes visible in git
5. **Resilient**: Works even if Brain is down (just create files)
