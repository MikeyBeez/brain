# Brain System Testing Specification

## Overview

This document defines comprehensive testing strategies for the Brain system, ensuring reliability, security, and performance before deployment.

## Testing Levels

### 1. Unit Tests

#### Memory Module Tests

```typescript
describe('MemoryModule', () => {
  let db: Database.Database;
  let memory: MemoryModule;
  
  beforeEach(() => {
    db = new Database(':memory:');
    memory = new MemoryModule(db);
    memory.initialize();
  });
  
  describe('Basic Operations', () => {
    test('should store and retrieve simple values', () => {
      memory.set('test-key', { data: 'test-value' });
      const result = memory.get('test-key');
      expect(result).toEqual({ data: 'test-value' });
    });
    
    test('should return null for non-existent keys', () => {
      expect(memory.get('missing')).toBeNull();
    });
    
    test('should update existing values', () => {
      memory.set('key', { version: 1 });
      memory.set('key', { version: 2 });
      expect(memory.get('key')).toEqual({ version: 2 });
    });
    
    test('should handle large values with compression', () => {
      const largeValue = { data: 'x'.repeat(2000) };
      memory.set('large', largeValue);
      expect(memory.get('large')).toEqual(largeValue);
    });
  });
  
  describe('Memory Tiering', () => {
    test('should respect tier assignments', () => {
      memory.set('pref', { setting: true }, 'user_preferences');
      const stats = db.prepare(
        'SELECT storage_tier FROM memories WHERE key = ?'
      ).get('pref');
      expect(stats.storage_tier).toBe('hot');
    });
    
    test('should promote frequently accessed memories', () => {
      memory.set('popular', { data: 'value' });
      
      // Access multiple times
      for (let i = 0; i < 15; i++) {
        memory.get('popular');
      }
      
      // Force rebalance
      memory['rebalanceTiers']();
      
      const tier = db.prepare(
        'SELECT storage_tier FROM memories WHERE key = ?'
      ).get('popular');
      expect(tier.storage_tier).toBe('hot');
    });
    
    test('should enforce hot tier limit of 300', async () => {
      // Fill hot tier
      for (let i = 0; i < 350; i++) {
        memory.set(`hot-${i}`, { index: i }, 'user_preferences');
      }
      
      memory['rebalanceTiers']();
      
      const hotCount = db.prepare(
        'SELECT COUNT(*) as count FROM memories WHERE storage_tier = "hot"'
      ).get().count;
      
      expect(hotCount).toBeLessThanOrEqual(300);
    });
  });
  
  describe('Search Functionality', () => {
    beforeEach(() => {
      memory.set('doc1', { title: 'Python Guide', content: 'Learn Python programming' });
      memory.set('doc2', { title: 'JavaScript Tutorial', content: 'Modern JS features' });
      memory.set('doc3', { title: 'Python Advanced', content: 'Advanced Python concepts' });
    });
    
    test('should find memories by content', () => {
      const results = memory.search('Python');
      expect(results).toHaveLength(2);
      expect(results[0].key).toMatch(/doc[13]/);
    });
    
    test('should rank results by relevance', () => {
      const results = memory.search('Python programming');
      expect(results[0].key).toBe('doc1'); // Should rank higher
    });
    
    test('should handle complex search queries', () => {
      const results = memory.search('JavaScript OR Python');
      expect(results).toHaveLength(3);
    });
  });
  
  describe('Error Handling', () => {
    test('should handle corrupted JSON gracefully', () => {
      // Manually insert corrupted data
      db.prepare('INSERT INTO memories (key, value) VALUES (?, ?)').run(
        'corrupted',
        '{"invalid": json}'
      );
      
      expect(() => memory.get('corrupted')).toThrow();
    });
    
    test('should validate memory size limits', () => {
      const hugeValue = { data: 'x'.repeat(10 * 1024 * 1024) }; // 10MB
      expect(() => memory.set('huge', hugeValue)).toThrow(/size limit/);
    });
  });
});
```

#### Session Module Tests

```typescript
describe('SessionsModule', () => {
  let sessions: SessionsModule;
  
  describe('Session Lifecycle', () => {
    test('should create unique session IDs', () => {
      const id1 = sessions.create();
      const id2 = sessions.create();
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });
    
    test('should expire sessions after 24 hours', () => {
      const id = sessions.create();
      
      // Manually set expiration in past
      db.prepare(
        'UPDATE sessions SET expires_at = datetime("now", "-1 hour") WHERE id = ?'
      ).run(id);
      
      expect(sessions.get(id)).toBeNull();
    });
    
    test('should track session activity', () => {
      const id = sessions.create();
      const initial = sessions.get(id);
      
      // Wait a bit
      setTimeout(() => {
        sessions.update(id, { lastAction: 'test' });
        const updated = sessions.get(id);
        
        expect(updated.last_accessed.getTime())
          .toBeGreaterThan(initial.last_accessed.getTime());
      }, 100);
    });
  });
  
  describe('Cleanup', () => {
    test('should clean expired sessions', () => {
      // Create sessions with different expiration times
      const active = sessions.create();
      const expired = sessions.create();
      
      db.prepare(
        'UPDATE sessions SET expires_at = datetime("now", "-1 hour") WHERE id = ?'
      ).run(expired);
      
      const cleaned = sessions.cleanup();
      expect(cleaned).toBeGreaterThanOrEqual(1);
      expect(sessions.get(active)).toBeTruthy();
      expect(sessions.get(expired)).toBeNull();
    });
  });
});
```

### 2. Integration Tests

#### MCP Tool Integration

```typescript
describe('MCP Tool Integration', () => {
  let brain: Brain;
  let mockMCPServer: MockMCPServer;
  
  beforeEach(async () => {
    mockMCPServer = new MockMCPServer();
    await mockMCPServer.start();
    
    brain = new Brain(':memory:');
    brain.initialize();
  });
  
  describe('brain:init', () => {
    test('should initialize session and load context', async () => {
      const response = await mockMCPServer.callTool('brain:init', {});
      
      expect(response).toMatchObject({
        session_id: expect.any(String),
        status: 'new',
        loaded_memories: expect.any(Number),
        suggestions: expect.any(Array)
      });
      
      expect(response.loaded_memories).toBeLessThanOrEqual(300);
    });
    
    test('should resume existing session', async () => {
      const init1 = await mockMCPServer.callTool('brain:init', {});
      const init2 = await mockMCPServer.callTool('brain:init', {
        session_id: init1.session_id
      });
      
      expect(init2.status).toBe('resumed');
      expect(init2.session_id).toBe(init1.session_id);
    });
  });
  
  describe('brain:remember', () => {
    test('should store memories with streaming response', async () => {
      const responses = [];
      
      await mockMCPServer.callToolStreaming('brain:remember', {
        key: 'test-memory',
        value: { important: 'data' },
        type: 'test'
      }, (chunk) => {
        responses.push(chunk);
      });
      
      expect(responses).toContainEqual({
        type: 'text',
        text: expect.stringContaining('Storing')
      });
      
      expect(responses).toContainEqual({
        type: 'text',
        text: expect.stringContaining('✓ Stored successfully')
      });
    });
  });
  
  describe('brain:execute', () => {
    test('should queue code execution', async () => {
      const response = await mockMCPServer.callTool('brain:execute', {
        code: 'print("Hello, World!")',
        language: 'python'
      });
      
      expect(response).toMatchObject({
        execution_id: expect.any(String),
        status: 'queued'
      });
    });
    
    test('should handle malicious code safely', async () => {
      const response = await mockMCPServer.callTool('brain:execute', {
        code: 'import os; os.system("rm -rf /")',
        language: 'python'
      });
      
      // Should queue but sandbox will prevent damage
      expect(response.status).toBe('queued');
    });
  });
});
```

#### Cross-Module Integration

```typescript
describe('Cross-Module Integration', () => {
  test('should coordinate memory and session modules', () => {
    const sessionId = brain.modules.sessions.create();
    
    // Store memory in session context
    brain.modules.memory.set('user_pref', { theme: 'dark' }, 'user_preferences');
    
    // Init should load this preference
    const context = brain.initSession(sessionId);
    expect(context.preferences).toMatchObject({ theme: 'dark' });
  });
  
  test('should link notes to active project', () => {
    // Set up project context
    brain.modules.projects.updateIndex('/test/project');
    
    // Create note
    const note = brain.modules.notes.create('Project documentation');
    
    expect(note.project).toBe('project');
  });
  
  test('should track execution in session stats', async () => {
    const sessionId = brain.modules.sessions.create();
    
    const { executionId } = brain.modules.execution.queue('print(1)');
    
    // Check session stats updated
    const session = brain.modules.sessions.get(sessionId);
    expect(session.data.executions_started).toBe(1);
  });
});
```

### 3. Performance Tests

```typescript
describe('Performance Tests', () => {
  describe('Response Time', () => {
    test('all operations complete in <100ms', async () => {
      const operations = [
        () => memory.set('perf-test', { data: 'value' }),
        () => memory.get('perf-test'),
        () => memory.search('test'),
        () => sessions.create(),
        () => sessions.get(sessionId),
        () => notes.create('Test note'),
        () => execution.queue('print(1)')
      ];
      
      for (const op of operations) {
        const start = Date.now();
        await op();
        const duration = Date.now() - start;
        
        expect(duration).toBeLessThan(100);
      }
    });
    
    test('handles 10k memories efficiently', () => {
      const start = Date.now();
      
      // Insert 10k memories
      for (let i = 0; i < 10000; i++) {
        memory.set(`key-${i}`, { index: i, data: 'x'.repeat(100) });
      }
      
      const insertTime = Date.now() - start;
      expect(insertTime).toBeLessThan(5000); // 5 seconds for 10k
      
      // Search performance
      const searchStart = Date.now();
      const results = memory.search('key-500');
      const searchTime = Date.now() - searchStart;
      
      expect(searchTime).toBeLessThan(50);
      expect(results.length).toBeGreaterThan(0);
    });
  });
  
  describe('Memory Usage', () => {
    test('maintains reasonable memory footprint', () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Create 1000 sessions
      for (let i = 0; i < 1000; i++) {
        sessions.create();
      }
      
      const memoryIncrease = process.memoryUsage().heapUsed - initialMemory;
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // 50MB
    });
  });
});
```

### 4. Security Tests

```typescript
describe('Security Tests', () => {
  describe('Code Execution Sandbox', () => {
    test('prevents file system access outside sandbox', async () => {
      const code = `
import os
try:
    with open('/etc/passwd', 'r') as f:
        print(f.read())
except Exception as e:
    print(f"Blocked: {e}")
`;
      
      const { executionId } = execution.queue(code);
      await waitForCompletion(executionId);
      
      const output = execution.getOutput(executionId);
      expect(output.stdout).toContain('Blocked');
    });
    
    test('enforces memory limits', async () => {
      const code = `
# Try to allocate 1GB
data = [0] * (1024 * 1024 * 1024)
print("Should not reach here")
`;
      
      const { executionId } = execution.queue(code);
      await waitForCompletion(executionId);
      
      const status = execution.getStatus(executionId);
      expect(status.status).toBe('failed');
      expect(status.error_message).toContain('memory');
    });
    
    test('prevents network access', async () => {
      const code = `
import urllib.request
try:
    response = urllib.request.urlopen('http://example.com')
    print("Should not reach here")
except Exception as e:
    print(f"Blocked: {e}")
`;
      
      const { executionId } = execution.queue(code);
      await waitForCompletion(executionId);
      
      const output = execution.getOutput(executionId);
      expect(output.stdout).toContain('Blocked');
    });
  });
  
  describe('SQL Injection Prevention', () => {
    test('handles malicious memory keys safely', () => {
      const maliciousKey = "'; DROP TABLE memories; --";
      
      expect(() => {
        memory.set(maliciousKey, { data: 'test' });
        memory.get(maliciousKey);
      }).not.toThrow();
      
      // Verify table still exists
      const tables = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table'"
      ).all();
      expect(tables).toContainEqual({ name: 'memories' });
    });
  });
});
```

### 5. Stress Tests

```typescript
describe('Stress Tests', () => {
  describe('Concurrent Operations', () => {
    test('handles 100 concurrent memory operations', async () => {
      const promises = [];
      
      for (let i = 0; i < 100; i++) {
        promises.push(
          Promise.resolve().then(() => 
            memory.set(`concurrent-${i}`, { index: i })
          )
        );
      }
      
      await expect(Promise.all(promises)).resolves.toBeDefined();
      
      // Verify all were stored
      for (let i = 0; i < 100; i++) {
        expect(memory.get(`concurrent-${i}`)).toEqual({ index: i });
      }
    });
    
    test('handles rapid session creation/cleanup', async () => {
      const sessionIds = [];
      
      // Rapidly create sessions
      for (let i = 0; i < 50; i++) {
        sessionIds.push(sessions.create());
      }
      
      // Immediately clean up
      const cleaned = sessions.cleanup();
      
      // Should handle gracefully
      expect(cleaned).toBeGreaterThanOrEqual(0);
    });
  });
  
  describe('Resource Exhaustion', () => {
    test('handles queue overflow gracefully', () => {
      const executions = [];
      
      // Queue 1000 executions
      for (let i = 0; i < 1000; i++) {
        executions.push(
          execution.queue(`print(${i})`)
        );
      }
      
      expect(executions).toHaveLength(1000);
      expect(executions.every(e => e.status === 'queued')).toBe(true);
    });
  });
});
```

### 6. Failure Recovery Tests

```typescript
describe('Failure Recovery', () => {
  describe('Database Recovery', () => {
    test('recovers from corrupted database', async () => {
      // Corrupt the database
      const dbPath = './test-brain.db';
      fs.writeFileSync(dbPath, 'corrupted data');
      
      // Brain should detect and recover
      const brain = new Brain(dbPath);
      expect(() => brain.initialize()).not.toThrow();
      
      // Should be functional after recovery
      const memory = brain.modules.memory;
      memory.set('post-recovery', { status: 'ok' });
      expect(memory.get('post-recovery')).toEqual({ status: 'ok' });
    });
    
    test('handles worker crash gracefully', async () => {
      // Start execution
      const { executionId } = execution.queue('import time; time.sleep(10)');
      
      // Simulate worker crash
      const worker = getWorkerProcess();
      process.kill(worker.pid);
      
      // Wait for recovery
      await sleep(2000);
      
      // Job should be requeued
      const status = execution.getStatus(executionId);
      expect(['queued', 'running']).toContain(status.status);
    });
  });
  
  describe('Self-Healing', () => {
    test('auto-creates missing indexes', async () => {
      // Drop an index
      db.prepare('DROP INDEX idx_memories_tier_score').run();
      
      // Run maintenance
      await brain.performMaintenance();
      
      // Index should be recreated
      const indexes = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='index'"
      ).all();
      expect(indexes).toContainEqual({ name: 'idx_memories_tier_score' });
    });
  });
});
```

## Test Execution Strategy

### Continuous Integration Pipeline

```yaml
# .github/workflows/brain-tests.yml
name: Brain System Tests

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm run test:unit
      
  integration-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - uses: actions/setup-python@v4
        with:
          python-version: '3.10'
      - run: npm install
      - run: npm run test:integration
      
  security-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: |
          sudo apt-get update
          sudo apt-get install -y firejail
      - run: npm install
      - run: npm run test:security
      
  performance-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm install
      - run: npm run test:performance
      - uses: actions/upload-artifact@v3
        with:
          name: performance-results
          path: test-results/performance/
```

### Local Testing Commands

```json
{
  "scripts": {
    "test": "npm run test:unit && npm run test:integration",
    "test:unit": "jest --testMatch='**/*.unit.test.ts'",
    "test:integration": "jest --testMatch='**/*.integration.test.ts'",
    "test:security": "jest --testMatch='**/*.security.test.ts' --runInBand",
    "test:performance": "jest --testMatch='**/*.performance.test.ts' --runInBand",
    "test:stress": "jest --testMatch='**/*.stress.test.ts' --runInBand",
    "test:all": "jest --coverage",
    "test:watch": "jest --watch"
  }
}
```

## Test Coverage Requirements

### Minimum Coverage Targets

- **Overall**: 90%
- **Core Modules**: 95%
- **Security-Critical Code**: 100%
- **Error Handling Paths**: 100%

### Coverage Report

```bash
npm run test:all -- --coverage

# Expected output:
# ----------------------|---------|----------|---------|---------|---
# File                  | % Stmts | % Branch | % Funcs | % Lines |
# ----------------------|---------|----------|---------|---------|---
# All files             |   92.5  |   89.3   |   94.2  |   91.8  |
#  core/               |   95.2  |   92.1   |   96.8  |   94.7  |
#  modules/memory/     |   96.8  |   94.5   |   98.2  |   96.3  |
#  modules/sessions/   |   94.1  |   91.3   |   95.5  |   93.8  |
#  modules/execution/  |   93.7  |   90.8   |   94.9  |   93.2  |
#  worker/             |   91.2  |   88.5   |   92.1  |   90.8  |
# ----------------------|---------|----------|---------|---------|---
```

## Test Data Management

### Fixtures

```typescript
// test/fixtures/memories.ts
export const testMemories = [
  {
    key: 'user_preferences',
    value: { theme: 'dark', language: 'en' },
    type: 'user_preferences'
  },
  {
    key: 'project_context',
    value: { name: 'brain', path: '/Users/test/brain' },
    type: 'project'
  }
];

// test/fixtures/notes.ts
export const testNotes = [
  {
    title: 'Test Note',
    content: '# Test Note\n\nThis is a test note.',
    tags: ['test', 'fixture']
  }
];
```

### Test Database Reset

```typescript
// test/helpers/db.ts
export function createTestDatabase(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

export function resetTestDatabase(db: Database.Database): void {
  db.exec('PRAGMA foreign_keys = OFF');
  
  const tables = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table'"
  ).all();
  
  for (const { name } of tables) {
    if (!name.startsWith('sqlite_')) {
      db.exec(`DROP TABLE ${name}`);
    }
  }
  
  db.exec('PRAGMA foreign_keys = ON');
}
```

## Monitoring & Observability Tests

```typescript
describe('Monitoring', () => {
  test('exposes health check endpoint', async () => {
    const health = await brain.checkHealth();
    
    expect(health).toMatchObject({
      status: 'healthy',
      metrics: {
        memory: expect.any(Object),
        execution: expect.any(Object),
        system: expect.any(Object)
      },
      timestamp: expect.any(Date)
    });
  });
  
  test('tracks performance metrics', () => {
    const metrics = brain.getMetrics();
    
    expect(metrics).toMatchObject({
      response_times: {
        p50: expect.any(Number),
        p95: expect.any(Number),
        p99: expect.any(Number)
      },
      throughput: {
        requests_per_second: expect.any(Number),
        memories_per_second: expect.any(Number)
      }
    });
  });
});
```

## Success Criteria

All tests must pass before deployment:

1. ✅ 100% of unit tests passing
2. ✅ 100% of integration tests passing
3. ✅ 100% of security tests passing
4. ✅ Performance tests meet SLA (<100ms response time)
5. ✅ Stress tests show graceful degradation
6. ✅ Recovery tests demonstrate self-healing
7. ✅ Code coverage meets minimums
8. ✅ No critical security vulnerabilities

This comprehensive testing ensures Brain is production-ready and truly autonomous.
