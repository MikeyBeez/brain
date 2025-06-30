# Storage Options Analysis for Brain

## Options Comparison

### 1. SQLite

**Advantages:**
- **Reliability**: ACID compliant, handles crashes gracefully
- **Query Power**: Complex queries, joins, full-text search with FTS5
- **Concurrent Access**: Built-in handling of multiple readers/writers
- **Performance**: Very fast for our use case (< 1GB data)
- **Flexibility**: Can store JSON in columns for hybrid approach
- **Maturity**: Battle-tested, used by many applications
- **Single File**: Easy to backup, no complex setup
- **Node.js Support**: Good libraries (better-sqlite3, sqlite3)

**Disadvantages:**
- **Binary Dependency**: Needs compiled module for Node.js
- **Not Human Readable**: Need tools to inspect/debug
- **Schema Management**: Need migrations for schema changes
- **Size**: Adds ~1MB to deployment

**Best For:**
- Complex queries across memories
- Pattern detection and analytics
- Concurrent access scenarios
- Long-term reliability

### 2. Graph Database (e.g., Neo4j, ArangoDB)

**Advantages:**
- **Relationship Queries**: Excellent for "how are X and Y connected?"
- **Natural Fit**: Knowledge graphs map perfectly
- **Visualization**: Often comes with graph visualization tools
- **Flexible Schema**: Easy to add new relationship types

**Disadvantages:**
- **Complexity**: Another service to run and manage
- **Overhead**: Overkill for our needs
- **Dependencies**: External service or embedded engine
- **Learning Curve**: Cypher/GraphQL queries
- **Memory Usage**: Can be memory intensive

**Best For:**
- Complex relationship analysis
- Social network-style queries
- When relationships are primary focus

### 3. JSON Files

**Advantages:**
- **Simplicity**: No dependencies, pure JavaScript
- **Human Readable**: Easy to debug and inspect
- **Version Control**: Can track changes in git
- **Portability**: Works anywhere Node.js runs
- **Direct Manipulation**: Can edit with any text editor
- **Native to Node.js**: JSON.parse/stringify built-in

**Disadvantages:**
- **No Queries**: Must load everything into memory to search
- **Concurrent Access**: Risk of corruption with multiple writers
- **Performance**: Slower for large datasets
- **No Transactions**: Can't guarantee atomic operations
- **Memory Usage**: Must parse entire file

**Best For:**
- Small datasets (< 10MB)
- Single-writer scenarios
- Simple key-value storage
- Maximum portability

## Hybrid Approach: SQLite with JSON Columns

```sql
CREATE TABLE memories (
    id INTEGER PRIMARY KEY,
    key TEXT UNIQUE,
    type TEXT,
    content JSON,  -- Flexible JSON storage
    tags TEXT,     -- Comma-separated for simple queries
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    access_count INTEGER DEFAULT 0
);

CREATE VIRTUAL TABLE memories_fts USING fts5(
    key, content, tags,
    content=memories
);
```

This gives us:
- Structured data where needed
- JSON flexibility for content
- Full-text search capabilities
- ACID compliance

## Recommendation: SQLite with JSON Columns

**Why:**
1. **Reliability First**: MCP tools must work 100% of the time
2. **Query Needs**: We need to search, filter, and analyze
3. **Proven Solution**: SQLite is used by Chrome, Firefox, mobile apps
4. **Growth Path**: Can handle millions of records
5. **Best of Both**: JSON columns provide flexibility

**Implementation Strategy:**
```javascript
// Using better-sqlite3 for synchronous operations in MCP
import Database from 'better-sqlite3';

const db = new Database('brain.db');

// Fast key-value operations
const remember = db.prepare(`
    INSERT OR REPLACE INTO memories (key, type, content, tags)
    VALUES (?, ?, json(?), ?)
`);

// Powerful search
const search = db.prepare(`
    SELECT * FROM memories
    WHERE id IN (
        SELECT rowid FROM memories_fts
        WHERE memories_fts MATCH ?
    )
    ORDER BY rank
`);
```

## Migration Path

If we start with JSON files:
1. Begin with simple JSON file storage
2. Add in-memory indexing for search
3. When performance degrades, migrate to SQLite
4. Keep JSON export/import for compatibility

## Decision Factors

Choose **JSON files** if:
- Simplicity is paramount
- Dataset will stay small (< 1000 items)
- Human readability is critical
- Want to avoid dependencies

Choose **SQLite** if:
- Need reliable concurrent access
- Want powerful query capabilities
- Plan to scale beyond 1000 items
- Need ACID compliance

Choose **Graph DB** if:
- Relationship queries are primary use case
- Willing to manage external service
- Need graph visualization
- Have complex interconnected data

## Final Recommendation

Start with **SQLite + JSON columns** because:
1. It's reliable enough for production
2. Supports our query needs
3. Can handle growth
4. Still allows JSON flexibility
5. Single file is easy to backup
6. Well-supported in Node.js ecosystem

The slight additional complexity is worth the reliability and capabilities we gain.
