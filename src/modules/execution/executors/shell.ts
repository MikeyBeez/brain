/**
 * Shell Executor
 * 
 * Executes shell commands with proper environment and error handling
 */

import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { logger } from '../../../core/database.js';
import { EventEmitter } from 'events';
import * as path from 'path';
import * as os from 'os';

interface ShellExecution {
  command: string;
  stdout: string;
  stderr: string;
  startTime: number;
  resolve: (result: ExecutionResult) => void;
  reject: (error: Error) => void;
  process?: ChildProcessWithoutNullStreams;
}

interface ExecutionResult {
  stdout: string;
  stderr: string;
  executionTime: string;
  exitCode: number;
  timestamp: string;
}

export class ShellExecutor extends EventEmitter {
  private executionQueue: ShellExecution[] = [];
  private currentExecution: ShellExecution | null = null;
  private isProcessing: boolean = false;

  constructor() {
    super();
    logger.info('Shell executor initialized');
  }

  async execute(command: string): Promise<ExecutionResult> {
    return new Promise((resolve, reject) => {
      const execution: ShellExecution = {
        command,
        stdout: '',
        stderr: '',
        startTime: Date.now(),
        resolve,
        reject
      };

      this.executionQueue.push(execution);
      this.processQueue();
    });
  }

  private processQueue(): void {
    if (this.isProcessing || this.executionQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    this.currentExecution = this.executionQueue.shift()!;
    const { command, startTime } = this.currentExecution;

    logger.info(`Executing shell command: ${command}`);

    // Determine shell based on OS
    const shell = os.platform() === 'win32' ? 'cmd.exe' : '/bin/bash';
    const shellArgs = os.platform() === 'win32' ? ['/c', command] : ['-c', command];

    // Spawn the shell process
    const proc = spawn(shell, shellArgs, {
      cwd: process.cwd(),
      env: {
        ...process.env,
        // Add any custom environment variables here
        BRAIN_SHELL: 'true'
      },
      shell: false // We're already using a shell
    });

    this.currentExecution.process = proc;

    // Handle stdout
    proc.stdout.on('data', (data: Buffer) => {
      if (this.currentExecution) {
        this.currentExecution.stdout += data.toString();
      }
    });

    // Handle stderr
    proc.stderr.on('data', (data: Buffer) => {
      if (this.currentExecution) {
        this.currentExecution.stderr += data.toString();
      }
    });

    // Handle errors
    proc.on('error', (error: Error) => {
      logger.error('Shell process error:', error);
      if (this.currentExecution) {
        this.currentExecution.reject(error);
        this.completeExecution(1);
      }
    });

    // Handle exit
    proc.on('exit', (code: number | null) => {
      this.completeExecution(code || 0);
    });
  }

  private completeExecution(exitCode: number): void {
    if (!this.currentExecution) return;

    const { stdout, stderr, startTime, resolve } = this.currentExecution;
    const executionTime = Date.now() - startTime;

    const result: ExecutionResult = {
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      executionTime: `${executionTime}ms`,
      exitCode,
      timestamp: new Date().toISOString()
    };

    logger.info(`Shell execution completed in ${executionTime}ms with exit code ${exitCode}`);

    resolve(result);
    this.currentExecution = null;
    this.isProcessing = false;
    
    // Process next in queue
    this.processQueue();
  }

  shutdown(): void {
    // Kill any running process
    if (this.currentExecution && this.currentExecution.process) {
      this.currentExecution.process.kill();
    }
    
    // Clear the queue
    this.executionQueue = [];
  }
}
