# Brain Index Tool Specification

## Overview

The `brain:index` tool manages the central index of project documentation in Brain's database. It handles all the complexity of tracking, categorizing, and retrieving project files, so Claude only needs to remember simple commands.

## Tool Interface (What Claude Sees)

```bash
brain:index --update     # Update the index for current project
brain:index --check      # Check for issues (orphaned/missing files)
brain:index --get [category] # Get relevant docs for a category
```

That's it. Claude doesn't need to know paths, SQL, or complex logic.

## Internal Implementation

### Core Functionality

```typescript
class BrainIndexTool {
  private db: BrainDatabase;
  
  async execute(params: IndexParams): Promise<IndexResult> {
    const projectPath = await this.detectCurrentProject();
    
    switch (params.operation) {
      case 'update':
        return this.updateIndex(projectPath);
      case 'check':
        return this.checkIndex(projectPath);
      case 'get':
        return this.getDocuments(projectPath, params.category);
      default:
        // Smart default: infer what's needed
        return this.smartOperation(projectPath);
    }
  }

  private async updateIndex(projectPath: string) {
    // 1. Scan project directory for documentation
    const files = await this.scanDirectory(projectPath, ['*.md', '*.txt']);
    
    // 2. Extract metadata from each file
    const fileMetadata = await Promise.all(
      files.map(async (file) => ({
        path: file.relativePath,
        purpose: await this.extractPurpose(file),
        category: await this.inferCategory(file),
        size: file.size,
        lastModified: file.lastModified,
        firstHeading: await this.extractFirstHeading(file),
        last_seen: new Date()
      }))
    );
    
    // 3. Update database
    await this.db.transaction(async (tx) => {
      // Mark all entries as potentially orphaned
      await tx.run(
        'UPDATE central_index SET status = "pending" WHERE project = ?',
        projectPath
      );
      
      // Upsert current files
      for (const meta of fileMetadata) {
        await tx.run(`
          INSERT OR REPLACE INTO central_index 
          (project, path, purpose, category, size, last_modified, first_heading, last_seen, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, "active")
        `, [projectPath, meta.path, meta.purpose, meta.category, 
            meta.size, meta.lastModified, meta.firstHeading, meta.last_seen]);
      }
      
      // Mark remaining as orphaned
      await tx.run(
        'UPDATE central_index SET status = "orphaned" WHERE project = ? AND status = "pending"',
        projectPath
      );
    });
    
    // 4. Return summary
    const stats = await this.getIndexStats(projectPath);
    return {
      success: true,
      message: `Updated index: ${stats.active} files, ${stats.orphaned} orphaned`,
      stats
    };
  }

  private async checkIndex(projectPath: string) {
    const issues = {
      orphaned: await this.db.all(
        'SELECT path FROM central_index WHERE project = ? AND status = "orphaned"',
        projectPath
      ),
      missing: [],
      stale: []
    };
    
    // Check for missing files (in index but not on disk)
    const indexedFiles = await this.db.all(
      'SELECT path, last_modified FROM central_index WHERE project = ? AND status = "active"',
      projectPath
    );
    
    for (const file of indexedFiles) {
      const fullPath = path.join(projectPath, file.path);
      if (!await this.fileExists(fullPath)) {
        issues.missing.push(file.path);
      } else {
        const stats = await fs.stat(fullPath);
        if (stats.mtime > file.last_modified) {
          issues.stale.push(file.path);
        }
      }
    }
    
    return {
      success: true,
      healthy: issues.orphaned.length === 0 && 
               issues.missing.length === 0 && 
               issues.stale.length === 0,
      issues
    };
  }

  private async getDocuments(projectPath: string, category?: string) {
    let query = 'SELECT * FROM central_index WHERE project = ? AND status = "active"';
    const params = [projectPath];
    
    if (category) {
      query += ' AND category = ?';
      params.push(category);
    } else {
      // Infer category from current context
      const inferredCategory = await this.inferCategoryFromContext();
      if (inferredCategory) {
        query += ' AND category = ?';
        params.push(inferredCategory);
      }
    }
    
    const docs = await this.db.all(query + ' ORDER BY category, path', params);
    
    return {
      success: true,
      documents: docs,
      message: `Found ${docs.length} documents${category ? ` in category: ${category}` : ''}`
    };
  }

  private async smartOperation(projectPath: string) {
    // Check if index exists
    const indexExists = await this.db.get(
      'SELECT COUNT(*) as count FROM central_index WHERE project = ?',
      projectPath
    );
    
    if (indexExists.count === 0) {
      // No index, create it
      return this.updateIndex(projectPath);
    }
    
    // Check freshness
    const checkResult = await this.checkIndex(projectPath);
    if (!checkResult.healthy) {
      // Issues found, update
      return this.updateIndex(projectPath);
    }
    
    // Everything good, return relevant docs
    return this.getDocuments(projectPath);
  }

  private async inferCategory(file: FileInfo): Promise<string> {
    // Smart category inference from file name and content
    const name = file.name.toUpperCase();
    
    if (name.includes('ARCH') || name.includes('DESIGN')) return 'architecture';
    if (name.includes('SPEC') || name.includes('REQUIREMENT')) return 'specification';
    if (name.includes('GUIDE') || name.includes('HOWTO')) return 'guide';
    if (name.includes('PLAN') || name.includes('STRATEGY')) return 'planning';
    if (name.includes('API') || name.includes('INTERFACE')) return 'api';
    
    // Check content if name doesn't give hints
    const content = await this.readFileStart(file.path, 500);
    if (content.includes('## Architecture') || content.includes('## Design')) return 'architecture';
    if (content.includes('## API') || content.includes('## Interface')) return 'api';
    
    return 'general';
  }
}
```

### Database Schema

```sql
CREATE TABLE central_index (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project TEXT NOT NULL,
  path TEXT NOT NULL,
  purpose TEXT,
  category TEXT,
  size INTEGER,
  last_modified DATETIME,
  first_heading TEXT,
  last_seen DATETIME,
  status TEXT DEFAULT 'active', -- active, orphaned
  UNIQUE(project, path)
);

CREATE INDEX idx_central_index_project_category ON central_index(project, category);
CREATE INDEX idx_central_index_status ON central_index(status);
```

## Integration with brain:init

```typescript
// brain:init automatically checks and updates index
async function brainInit(sessionId: string) {
  const context = await loadKnowledgeGraph();
  const project = context.currentProject;
  
  if (project) {
    // Auto-run index check
    const indexStatus = await brainIndex.execute({ 
      operation: 'check' 
    });
    
    // Auto-update if needed
    if (!indexStatus.healthy) {
      await brainIndex.execute({ 
        operation: 'update' 
      });
    }
    
    // Load relevant docs
    const docs = await brainIndex.execute({ 
      operation: 'get',
      category: inferCategoryFromContext()
    });
    
    // Include in context
    context.projectDocumentation = docs.documents;
  }
  
  return context;
}
```

## Usage Examples

### Claude's perspective:
```bash
# Start working on Brain project
brain:init
# → Automatically updates index if needed, loads relevant docs

# After creating new documentation
brain:index --update
# → "Updated index: 23 files, 2 orphaned"

# Need specific docs
brain:index --get architecture
# → Returns list of architecture documents

# Check for issues
brain:index --check
# → "Found 2 orphaned files, 1 missing file"
```

### What Claude doesn't need to know:
- SQL queries
- File system operations
- Category inference logic
- Index freshness calculations
- Transaction handling

## Benefits

1. **Simple Interface**: Three commands handle everything
2. **Smart Defaults**: Tool infers what's needed
3. **Automatic Maintenance**: Detects orphaned/missing files
4. **Context Aware**: Loads relevant docs based on conversation
5. **Low Cognitive Load**: Claude just triggers, tool thinks

## Success Criteria

- [ ] Claude can update index with one command
- [ ] Index tracks all project documentation
- [ ] Orphaned/missing files are detected
- [ ] Relevant docs are loaded based on context
- [ ] No SQL or file paths in Claude's commands
