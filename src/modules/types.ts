/**
 * Brain Module System - Type Definitions
 * 
 * This is the SINGLE SOURCE OF TRUTH for all module interfaces and shared types.
 * Any changes to module interfaces require updating this file.
 * 
 * Last updated: 2024-01-28 (Inconsistency Resolution)
 */

import Database from 'better-sqlite3';

// ============================================================================
// CORE TYPES
// ============================================================================

/**
 * Base module interface that all modules must implement
 */
export interface BrainModule {
  initialize(): void;
  validate(): boolean;
  cleanup(): void;
  getName(): string;
  getCapabilities(): string[];
}

/**
 * Standard response format for all MCP tools
 */
export interface ToolResponse {
  type: 'text';
  text: string;
}

/**
 * Standard tool definition
 */
export interface Tool {
  name: string;
  description: string;
  inputSchema: object;
  execute: (args: any) => AsyncGenerator<ToolResponse>;
}

// ============================================================================
// SHARED TYPES
// ============================================================================

export interface SearchResult {
  key: string;
  value: any;
  score: number;
}

export interface Note {
  id: string;
  content: string;
  title?: string;
  tags?: string[];
  created_at: string;
  file_path?: string;
}

export interface ExecutionStatus {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  created_at: string;
  started_at?: string;
  completed_at?: string;
  exit_code?: number;
}

export interface ExecutionSummary {
  id: string;
  status: string;
  created_at: string;
  language: string;
}

export interface Session {
  id: string;
  started_at: Date;
  last_accessed: Date;
  data: any;
}

export interface IndexResult {
  success: boolean;
  files_indexed: number;
  files_orphaned: number;
}

export interface Document {
  path: string;
  category: string;
  purpose: string;
  last_modified: string;
}

export interface HealthCheck {
  healthy: boolean;
  issues: {
    orphaned: string[];
    missing: string[];
    stale: string[];
  };
}

export interface NoteFilters {
  days?: number;
  tags?: string[];
  project?: string;
  limit?: number;
}

// ============================================================================
// MODULE INTERFACES
// ============================================================================

/**
 * Memory Module - Core memory operations
 * No delete method (YAGNI principle)
 */
export interface MemoryModuleInterface extends BrainModule {
  set(key: string, value: any, type?: string): void;
  get(key: string): any;
  search(query: string, limit?: number): SearchResult[];
}

/**
 * Notes Module - Note-taking system
 */
export interface NotesModuleInterface extends BrainModule {
  create(content: string, title?: string, tags?: string[]): Note;
  get(id: string): Note | null;
  search(query: string, filters?: NoteFilters): Note[];
  update(id: string, updates: Partial<Note>): void;
}

/**
 * Projects Module - Project index management
 */
export interface ProjectsModuleInterface extends BrainModule {
  updateIndex(projectPath: string): IndexResult;
  checkIndex(projectPath: string): HealthCheck;
  getDocuments(projectPath: string, category?: string): Document[];
  detectProject(): string | null;
}

/**
 * Execution Module - Code execution scheduling
 * Only queues jobs - actual execution handled by worker process
 */
export interface ExecutionModuleInterface extends BrainModule {
  queue(code: string, language: string): { executionId: string; status: 'queued' };
  getStatus(executionId: string): ExecutionStatus;
  getOutput(executionId: string): { stdout: string; stderr: string } | null;
  listExecutions(limit?: number): ExecutionSummary[];
}

/**
 * Sessions Module - Session management
 * Includes update method for session state changes
 */
export interface SessionsModuleInterface extends BrainModule {
  create(): string;
  get(id: string): Session | null;
  update(id: string, data: any): void;
  cleanup(): number; // Returns number of cleaned sessions
}

// ============================================================================
// BRAIN CONTEXT
// ============================================================================

/**
 * Context returned by brain:init
 */
export interface BrainContext {
  session_id: string;
  status: 'new' | 'resumed';
  user: string;
  context: {
    preferences?: any;
    active_project?: string;
    recent_memories?: SearchResult[];
    recent_notes?: Note[];
  };
  loaded_memories: number;
  suggestions: string[];
}

/**
 * Status information returned by brain:status
 */
export interface BrainStatus {
  status: 'active' | 'not_initialized';
  session?: Session;
  system?: {
    uptime: number;
    memory_usage: number;
    total_memories: number;
    total_notes: number;
  };
  execution?: ExecutionStatus;
}

// ============================================================================
// MODULE COLLECTION
// ============================================================================

/**
 * Collection of all modules used by Brain
 */
export interface BrainModules {
  memory: MemoryModuleInterface;
  notes: NotesModuleInterface;
  projects: ProjectsModuleInterface;
  execution: ExecutionModuleInterface;
  sessions: SessionsModuleInterface;
}
