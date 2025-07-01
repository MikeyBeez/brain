/**
 * Brain Execution Module
 * 
 * Provides multi-language execution capabilities with automatic language detection.
 * Supports Python and Shell commands with transparent logging.
 */

import { logger } from '../../core/database.js';
import * as fs from 'fs';
import * as path from 'path';
import { PythonExecutor } from './executors/python.js';
import { ShellExecutor } from './executors/shell.js';
import { LanguageDetector } from './executors/detector.js';

interface ExecutionResult {
  stdout: string;
  stderr: string;
  executionTime: string;
  timestamp: string;
  language?: string;
  exitCode?: number;
}

interface ExecutionOptions {
  description?: string;
  language?: 'python' | 'shell' | 'auto';
  workingDirectory?: string;
}

class ExecutionLogger {
  private logDir: string;
  
  constructor() {
    this.logDir = path.join(process.env.BRAIN_DATA_DIR || '/Users/bard/Code/brain', 'logs', 'execution');
    // Ensure log directory exists
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }
  
  private generateExecutionId(): string {
    const date = new Date();
    const dateStr = date.toISOString().split('T')[0];
    const count = fs.readdirSync(this.logDir)
      .filter(f => f.startsWith(`exec_exec-${dateStr}`)).length + 1;
    return `exec-${dateStr}-${count.toString().padStart(3, '0')}`;
  }
  
  private writeLogEntry(executionId: string, entry: any): void {
    const logFile = path.join(this.logDir, `exec_${executionId}.json`);
    const logEntry = JSON.stringify({
      execution_id: executionId,
      timestamp: new Date().toISOString(),
      ...entry
    }) + '\n';
    
    fs.appendFileSync(logFile, logEntry);
  }
  
  logExecution(code: string, description: string, language: string = 'python'): string {
    const executionId = this.generateExecutionId();
    
    // Log start with more detail
    this.writeLogEntry(executionId, {
      type: 'start',
      language,
      status: 'running',
      message: description || `Starting ${language} execution`,
      description: description
    });
    
    // Log code with full content (not truncated)
    this.writeLogEntry(executionId, {
      type: 'code',
      message: description || 'Executing code',
      code: code,
      code_length: code.length,
      code_lines: code.split('\n').length
    });
    
    return executionId;
  }
  
  logOutput(executionId: string, stdout: string, stderr: string): void {
    const output = stdout + (stderr ? `\n\nErrors:\n${stderr}` : '');
    
    this.writeLogEntry(executionId, {
      type: 'output',
      message: 'Output received',
      output: output
    });
  }
  
  logComplete(executionId: string, success: boolean = true): void {
    this.writeLogEntry(executionId, {
      type: 'complete',
      status: success ? 'completed' : 'failed',
      message: success ? 'Execution completed successfully' : 'Execution failed'
    });
  }
}

// Create singleton logger instance
const executionLogger = new ExecutionLogger();

// Create singleton executors
let pythonExecutor: PythonExecutor | null = null;
let shellExecutor: ShellExecutor | null = null;

// Create singleton instance
export const executionModule = {
  name: 'execution',

  initialize(): void {
    // Initialize Python executor
    pythonExecutor = new PythonExecutor();
    pythonExecutor.initialize();
    
    // Initialize Shell executor
    shellExecutor = new ShellExecutor();
    
    logger.info('Execution module initialized with Python and Shell support');
  },

  async execute(code: string, options: ExecutionOptions = {}): Promise<ExecutionResult> {
    if (!pythonExecutor || !shellExecutor) {
      throw new Error('Execution module not initialized');
    }

    // Determine language
    let language: 'python' | 'shell';
    let detectionReason = '';
    
    if (options.language && options.language !== 'auto') {
      // Use explicitly specified language
      language = options.language;
      detectionReason = 'Explicitly specified';
    } else {
      // Auto-detect language
      const detection = LanguageDetector.detect(code);
      language = detection.language;
      detectionReason = detection.reason;
      
      logger.info(`Language auto-detected as ${language}: ${detectionReason}`);
    }

    // Start logging to Monitex
    const executionId = executionLogger.logExecution(
      code, 
      options.description || `${language} code execution`,
      language
    );

    logger.info(`Executing ${language} code:`, {
      executionId,
      description: options.description || 'No description provided',
      codeLength: code.length,
      language,
      detectionReason
    });

    try {
      let result: ExecutionResult;
      
      if (language === 'shell') {
        // Execute as shell command
        result = await shellExecutor.execute(code);
      } else {
        // Execute as Python code
        result = await pythonExecutor.execute(code);
      }
      
      // Add language info to result
      result.language = language;
      
      // Log output to Monitex
      executionLogger.logOutput(executionId, result.stdout, result.stderr);
      
      // Log completion to Monitex
      executionLogger.logComplete(executionId, true);
      
      // Log execution for transparency
      logger.info('Execution result:', {
        executionId,
        language,
        stdout: result.stdout.substring(0, 200) + (result.stdout.length > 200 ? '...' : ''),
        stderr: result.stderr,
        executionTime: result.executionTime
      });

      return result;
    } catch (error) {
      // Log failure to Monitex
      executionLogger.logComplete(executionId, false);
      throw error;
    }
  },

  shutdown(): void {
    if (pythonExecutor) {
      pythonExecutor.shutdown();
    }
    if (shellExecutor) {
      shellExecutor.shutdown();
    }
  }
};
