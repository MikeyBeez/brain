/**
 * Python Executor
 * 
 * Maintains a persistent Python REPL for immediate feedback
 */

import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { logger } from '../../../core/database.js';
import { EventEmitter } from 'events';

interface PythonExecution {
  code: string;
  stdout: string;
  stderr: string;
  startTime: number;
  resolve: (result: ExecutionResult) => void;
  reject: (error: Error) => void;
  isInternal: boolean;
}

interface ExecutionResult {
  stdout: string;
  stderr: string;
  executionTime: string;
  timestamp: string;
}

export class PythonExecutor extends EventEmitter {
  private process: ChildProcessWithoutNullStreams | null = null;
  private isReady: boolean = false;
  private executionQueue: PythonExecution[] = [];
  private currentExecution: PythonExecution | null = null;

  initialize(): void {
    logger.info('Initializing Python executor...');
    
    // Start Python in interactive mode with unbuffered output
    this.process = spawn('python3', ['-i', '-u'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Handle process output
    this.process.stdout.on('data', (data: Buffer) => {
      if (this.currentExecution) {
        this.currentExecution.stdout += data.toString();
      }
    });

    this.process.stderr.on('data', (data: Buffer) => {
      const output = data.toString();
      // Python interactive mode sends prompt to stderr
      if (output.includes('>>>') || output.includes('...')) {
        if (!this.isReady) {
          this.isReady = true;
          logger.info('Python executor ready');
          this.processQueue();
        }
      } else if (this.currentExecution) {
        this.currentExecution.stderr += output;
      }
    });

    this.process.on('error', (error: Error) => {
      logger.error('Python process error:', error);
      if (this.currentExecution) {
        this.currentExecution.reject(error);
      }
    });

    this.process.on('exit', (code: number | null) => {
      logger.error(`Python process exited with code ${code}`);
      this.isReady = false;
      // Restart the process
      setTimeout(() => this.initialize(), 1000);
    });

    // Inject Brain context
    this.injectBrainContext();
  }

  private async injectBrainContext(): Promise<void> {
    // Wait for Python to be ready
    while (!this.isReady) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const setupCode = `
import sys
import os
import json
import subprocess
from datetime import datetime
import sqlite3

# Brain database connection
BRAIN_DB_PATH = '${process.env.BRAIN_DATA_DIR || '/Users/bard/Code/brain/data'}/brain.db'

class Brain:
    def __init__(self):
        self.db_path = BRAIN_DB_PATH
    
    def query(self, sql, params=None):
        """Execute a read-only query on the Brain database"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        if params:
            cursor.execute(sql, params)
        else:
            cursor.execute(sql)
        results = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return results
    
    def get_memories(self, limit=10):
        """Get recent memories"""
        return self.query(
            "SELECT * FROM memories ORDER BY created_at DESC LIMIT ?", 
            (limit,)
        )
    
    def search_memories(self, query_text):
        """Search memories by content"""
        return self.query(
            "SELECT * FROM memories WHERE content LIKE ? ORDER BY created_at DESC",
            (f'%{query_text}%',)
        )

# Create global brain instance
brain = Brain()

print("Brain context loaded. Python executor ready.")
print(f"Database path: {BRAIN_DB_PATH}")
`;

    await this.execute(setupCode, true);
  }

  async execute(code: string, isInternal: boolean = false): Promise<ExecutionResult> {
    return new Promise((resolve, reject) => {
      const execution: PythonExecution = {
        code,
        stdout: '',
        stderr: '',
        startTime: Date.now(),
        resolve,
        reject,
        isInternal
      };

      this.executionQueue.push(execution);
      this.processQueue();
    });
  }

  private processQueue(): void {
    if (!this.isReady || this.currentExecution || this.executionQueue.length === 0) {
      return;
    }

    this.currentExecution = this.executionQueue.shift()!;
    const { code, startTime } = this.currentExecution;

    // Clear output buffers
    this.currentExecution.stdout = '';
    this.currentExecution.stderr = '';

    // Send code to Python
    this.process!.stdin.write(code + '\n');

    // Set up completion detection
    const completeTimer = setInterval(() => {
      // Check if we've received a prompt indicating completion
      const output = this.currentExecution!.stdout + this.currentExecution!.stderr;
      if (output.includes('>>>') || 
          (this.currentExecution!.stderr.includes('>>>') && 
           Date.now() - startTime > 100)) {
        clearInterval(completeTimer);
        this.completeExecution();
      }
      
      // Timeout after 5 seconds
      if (Date.now() - startTime > 5000) {
        clearInterval(completeTimer);
        this.completeExecution();
      }
    }, 50);
  }

  private completeExecution(): void {
    if (!this.currentExecution) return;

    const { stdout, stderr, startTime, resolve, isInternal } = this.currentExecution;
    const executionTime = Date.now() - startTime;

    const result: ExecutionResult = {
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      executionTime: `${executionTime}ms`,
      timestamp: new Date().toISOString()
    };

    if (!isInternal) {
      logger.info(`Python execution completed in ${executionTime}ms`);
    }

    resolve(result);
    this.currentExecution = null;
    this.processQueue();
  }

  shutdown(): void {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
  }
}
