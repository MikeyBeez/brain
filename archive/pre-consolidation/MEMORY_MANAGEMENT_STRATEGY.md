# Brain Memory Management Strategy

## The 300 Node Constraint

When brain:init loads context, we have approximately 300 nodes worth of space in the context window. This requires intelligent memory management.

## Memory Hierarchy

### 1. Hot Memory (Loaded on Init) - Max 300 items
```sql
-- Only the most essential items loaded at startup
CREATE VIEW hot_memories AS
SELECT * FROM memories 
WHERE (
    type IN ('user_preference', 'active_project', 'recent_command') 
    OR accessed_at > datetime('now', '-7 days')
    OR access_count > 10
)
ORDER BY 
    CASE type 
        WHEN 'user_preference' THEN 1
        WHEN 'active_project' THEN 2
        WHEN 'recent_command' THEN 3
        ELSE 4
    END,
    access_count DESC,
    accessed_at DESC
LIMIT 300;
```

### 2. Warm Memory (Loaded on Demand)
Everything else stays in SQLite and is loaded only when:
- User specifically searches for it
- Related to current context
- Pattern matching suggests it's needed

## Smart Loading Strategy

### brain:init Behavior
```typescript
async function* handleInit(args: any) {
  yield { type: 'text', text: '🧠 Initializing Brain...' };
  
  // Load only critical items
  const criticalMemories = await db.getCriticalMemories();
  yield { type: 'text', text: `Loading ${criticalMemories.length} essential memories...` };
  
  // Group by type for efficient context
  const grouped = {
    preferences: criticalMemories.filter(m => m.type === 'user_preference'),
    projects: criticalMemories.filter(m => m.type === 'active_project'),
    recent: criticalMemories.filter(m => m.type === 'recent_command'),
    frequent: criticalMemories.filter(m => m.access_count > 10)
  };
  
  // Return structured context
  return {
    session_id: session.id,
    loaded_count: criticalMemories.length,
    total_memories: totalCount,
    context: grouped,
    message: `Loaded ${criticalMemories.length} of ${totalCount} memories. Use brain:recall to search all memories.`
  };
}
```

### Memory Types and Priorities

```typescript
enum MemoryType {
  // Always loaded (high priority)
  USER_PREFERENCE = 'user_preference',      // ~10 items
  ACTIVE_PROJECT = 'active_project',        // ~10 items  
  CURRENT_CONTEXT = 'current_context',      // ~20 items
  
  // Conditionally loaded (medium priority)
  RECENT_COMMAND = 'recent_command',        // ~50 items
  FREQUENT_PATTERN = 'frequent_pattern',    // ~50 items
  PROJECT_KNOWLEDGE = 'project_knowledge',  // ~100 items
  
  // Rarely loaded (low priority)
  ARCHIVED_PROJECT = 'archived_project',
  OLD_COMMAND = 'old_command',
  REFERENCE_DATA = 'reference_data'
}
```

### Intelligent Pruning

```sql
-- Mark memories for hot/warm/cold storage
ALTER TABLE memories ADD COLUMN storage_tier TEXT DEFAULT 'warm';

-- Update storage tiers based on usage
UPDATE memories 
SET storage_tier = CASE
    WHEN type IN ('user_preference', 'active_project') THEN 'hot'
    WHEN accessed_at > datetime('now', '-7 days') THEN 'hot'
    WHEN access_count > 10 THEN 'hot'
    WHEN accessed_at > datetime('now', '-30 days') THEN 'warm'
    ELSE 'cold'
END;
```

## Context Window Management

### 1. Automatic Summarization
For frequently accessed groups of memories, create summaries:

```typescript
// Instead of loading 50 individual commands
const commandSummary = {
  key: 'recent_commands_summary',
  value: {
    total: 50,
    categories: {
      git: 15,
      python: 20,
      file_ops: 15
    },
    most_frequent: ['git commit', 'python test.py', 'cd /Users/bard/Code']
  }
};
```

### 2. Lazy Loading References
Store references instead of full content:

```typescript
// Instead of storing full file content
{
  key: 'project_file_main.py',
  value: {
    path: '/Users/bard/Code/brain/main.py',
    size: 1024,
    hash: 'abc123...',
    summary: 'Main entry point for Brain MCP server'
  }
}

// Load full content only when needed
if (userAsksAboutFile) {
  const content = await loadFileContent(memory.value.path);
}
```

### 3. Hierarchical Loading
Load overview first, details on demand:

```typescript
// Level 1: Project list (loaded on init)
{
  key: 'projects_overview',
  value: ['brain', 'cortex_2', 'nexus_3', 'anna_2']
}

// Level 2: Project summary (loaded when switching projects)
{
  key: 'project_brain_summary',
  value: {
    description: 'Unified cognitive system',
    last_modified: '2024-01-27',
    key_files: ['ENGINEERING_SPEC.md', 'src/index.ts']
  }
}

// Level 3: Full project context (loaded when working on project)
{
  key: 'project_brain_full',
  value: { /* complete project knowledge */ }
}
```

## Implementation in Database

```sql
-- Add metadata for smart loading
ALTER TABLE memories ADD COLUMN metadata JSON;

-- Example metadata
{
  "size_estimate": 150,  -- Estimated context tokens
  "load_priority": 1,    -- 1=always, 2=conditional, 3=rare
  "parent_key": null,    -- For hierarchical data
  "summary_of": null,    -- If this is a summary
  "last_loaded": null    -- Track when loaded into context
}
```

## Usage Patterns

### brain:recall with Smart Loading
```typescript
async function* handleRecall(args: any) {
  const { query, load_full = false } = args;
  
  // First search in hot memories (already loaded)
  const hotResults = searchHotMemories(query);
  if (hotResults.length > 0) {
    yield { type: 'text', text: `Found ${hotResults.length} results in active memory` };
  }
  
  // Then search warm/cold memories
  const allResults = await db.searchAllMemories(query);
  const coldResults = allResults.length - hotResults.length;
  
  if (coldResults > 0) {
    yield { type: 'text', text: `Found ${coldResults} additional results in storage` };
    
    if (load_full) {
      yield { type: 'text', text: 'Loading full results into context...' };
      // Selectively load the most relevant
    } else {
      yield { type: 'text', text: 'Use load_full=true to load these into active memory' };
    }
  }
}
```

## Benefits

1. **Stays under 300 node limit** on initialization
2. **Fast startup** - only load essentials
3. **Full access** - all memories searchable
4. **Smart loading** - brings in relevant content as needed
5. **Efficient** - summaries and hierarchies reduce redundancy

This approach ensures Brain can scale to thousands of memories while respecting the context window constraint.
