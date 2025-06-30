# Brain Coding Guidelines

## Core Principle: Commit to Decisions

### The Problem We're Solving

We've identified a critical anti-pattern: overparameterization and leaving options in the code. This creates:
- Dead code that confuses future readers
- Unnecessary abstractions that add complexity
- Indecision that spreads throughout the codebase
- False flexibility that never gets used

### The Solution: YAGNI + Full Commitment

**"You Aren't Gonna Need It" + "When we decide, we commit fully"**

## Rules

### 1. No Abstractions Until Needed Twice
```typescript
// ❌ DON'T: Create interfaces "just in case"
interface StorageProvider {
  get(key: string): Promise<any>;
  set(key: string, value: any): Promise<void>;
}

// ✅ DO: Direct implementation
class BrainDatabase {
  private db: Database.Database;
  
  get(key: string) {
    // Direct SQLite implementation
  }
}
```

### 2. No Dead Code Comments
```typescript
// ❌ DON'T: Leave options in comments
// Option 1: Synchronous approach
// const result = db.get(key);

// Option 2: Async approach  
// const result = await db.getAsync(key);

// Using Option 2 for now
const result = await db.getAsync(key);

// ✅ DO: Implement one way
const result = await db.getAsync(key);
```

### 3. No Unused Parameters
```typescript
// ❌ DON'T: Add parameters for future flexibility
function createDatabase(type: 'sqlite' | 'postgres' = 'sqlite') {
  if (type === 'sqlite') {
    return new SQLiteDatabase();
  }
  // postgres "coming soon"...
}

// ✅ DO: Build what we need now
function createDatabase() {
  return new SQLiteDatabase();
}
```

### 4. Delete, Don't Comment
When changing approaches:
- Delete the old code
- Write a clear commit message
- Trust Git to remember

### 5. Concrete Over Abstract
```typescript
// ❌ DON'T: Generic names and interfaces
interface Tool {
  execute(params: any): Promise<any>;
}

// ✅ DO: Specific, clear implementations
class BrainInitTool {
  async execute(sessionId: string): Promise<InitResult> {
    // Specific implementation
  }
}
```

## Brain-Specific Decisions (Committed)

1. **Storage**: SQLite with better-sqlite3. No StorageProvider interface.
2. **Server**: TypeScript with MCP SDK. No language bridges.
3. **Tools**: Direct MCP tool implementations. No command patterns.
4. **Database**: Synchronous better-sqlite3. No async wrappers.
5. **Sessions**: In-memory Map with SQLite backup. No Redis.
6. **IPC**: MCP protocol only. No HTTP during execution.

## When to Abstract

Only create abstractions when:
1. You have two concrete implementations
2. They share significant behavior
3. The abstraction makes the code clearer

## Benefits

- **Clarity**: Code shows exactly what it does
- **Simplicity**: No unused complexity
- **Confidence**: Decisions are final until proven wrong
- **Maintainability**: No dead code to maintain
- **Performance**: No abstraction overhead

## Examples from Brain

### Good: Direct SQLite usage
```typescript
import Database from 'better-sqlite3';

export class BrainDatabase {
  private db: Database.Database;
  
  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
  }
  
  remember(key: string, value: any) {
    const stmt = this.db.prepare(
      'INSERT OR REPLACE INTO memories (key, value) VALUES (?, ?)'
    );
    stmt.run(key, JSON.stringify(value));
  }
}
```

### Bad: Overparameterized storage
```typescript
interface Storage {
  save(key: string, value: any): void;
}

class StorageFactory {
  static create(type: string): Storage {
    // Unnecessary abstraction
  }
}
```

## Remember

- Git remembers everything - you don't need to
- Working code > flexible code
- Clarity > cleverness
- Decision > indecision

When in doubt, build the simplest thing that works. We can always refactor when we have real requirements, not imagined ones.
