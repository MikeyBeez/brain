/**
 * Memory Module Tests
 */

import { MemoryModule } from '../index';
import { DatabaseConnection } from '../../../core/database';
import Database from 'better-sqlite3';

describe('MemoryModule', () => {
  let memoryModule: MemoryModule;
  let db: Database.Database;
  
  beforeAll(() => {
    // Use in-memory database for tests
    process.env.BRAIN_DATA_DIR = ':memory:';
    db = DatabaseConnection.getInstance();
    memoryModule = new MemoryModule();
  });
  
  afterAll(() => {
    db.close();
  });
  
  beforeEach(() => {
    // Clear memories table
    db.exec('DELETE FROM memories');
  });
  
  describe('initialize', () => {
    it('should initialize without errors', () => {
      expect(() => memoryModule.initialize()).not.toThrow();
    });
    
    it('should be idempotent', () => {
      memoryModule.initialize();
      expect(() => memoryModule.initialize()).not.toThrow();
    });
  });
  
  describe('set and get', () => {
    it('should store and retrieve simple values', () => {
      memoryModule.set('test_key', 'test_value');
      expect(memoryModule.get('test_key')).toBe('test_value');
    });
    
    it('should store and retrieve objects', () => {
      const obj = { name: 'test', value: 123, nested: { a: 1 } };
      memoryModule.set('test_obj', obj);
      expect(memoryModule.get('test_obj')).toEqual(obj);
    });
    
    it('should update existing memories', () => {
      memoryModule.set('update_key', 'value1');
      memoryModule.set('update_key', 'value2');
      expect(memoryModule.get('update_key')).toBe('value2');
    });
    
    it('should return null for non-existent keys', () => {
      expect(memoryModule.get('non_existent')).toBeNull();
    });
    
    it('should handle different types', () => {
      memoryModule.set('user_pref', { lang: 'Python' }, 'user_preferences');
      memoryModule.set('project', '/path/to/project', 'active_project');
      
      expect(memoryModule.get('user_pref')).toEqual({ lang: 'Python' });
      expect(memoryModule.get('project')).toBe('/path/to/project');
    });
  });
  
  describe('search', () => {
    beforeEach(() => {
      memoryModule.set('python_tips', 'Use list comprehensions for cleaner code');
      memoryModule.set('javascript_tips', 'Use const for immutable values');
      memoryModule.set('user_preferences', { language: 'Python', style: 'concise' });
    });
    
    it('should find memories by key', () => {
      const results = memoryModule.search('python');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].key).toBe('python_tips');
    });
    
    it('should find memories by value', () => {
      const results = memoryModule.search('comprehensions');
      expect(results.length).toBe(1);
      expect(results[0].key).toBe('python_tips');
    });
    
    it('should return empty array for no matches', () => {
      const results = memoryModule.search('nonexistent');
      expect(results).toEqual([]);
    });
    
    it('should respect limit parameter', () => {
      // Add more memories
      for (let i = 0; i < 20; i++) {
        memoryModule.set(`test_${i}`, `value with Python ${i}`);
      }
      
      const results = memoryModule.search('Python', 5);
      expect(results.length).toBe(5);
    });
  });
  
  describe('memory tiering', () => {
    it('should assign hot tier to user preferences', () => {
      memoryModule.set('user_preferences', { test: true }, 'user_preferences');
      
      const result = db.prepare('SELECT storage_tier FROM memories WHERE key = ?')
        .get('user_preferences') as any;
      
      expect(result.storage_tier).toBe('hot');
    });
    
    it('should track access count', () => {
      memoryModule.set('access_test', 'value');
      
      // Access multiple times
      memoryModule.get('access_test');
      memoryModule.get('access_test');
      memoryModule.get('access_test');
      
      const result = db.prepare('SELECT access_count FROM memories WHERE key = ?')
        .get('access_test') as any;
      
      expect(result.access_count).toBe(3);
    });
  });
  
  describe('module interface', () => {
    it('should return correct name', () => {
      expect(memoryModule.getName()).toBe('memory');
    });
    
    it('should return capabilities', () => {
      const capabilities = memoryModule.getCapabilities();
      expect(capabilities).toContain('set');
      expect(capabilities).toContain('get');
      expect(capabilities).toContain('search');
      expect(capabilities).toContain('tiering');
    });
    
    it('should validate successfully', () => {
      memoryModule.initialize();
      expect(memoryModule.validate()).toBe(true);
    });
  });
});
