/**
 * Brain Execute Tool
 * 
 * Execute Python code with full system access and immediate feedback.
 * Provides transparent logging of all operations.
 */

import { Tool, ToolResponse } from '../modules/types.js';
import { executionModule } from '../modules/execution/index.js';
import { logger } from '../core/database.js';

export const brainExecuteTool: Tool = {
  name: 'brain_execute',
  description: 'Execute Python code with full system access. Returns stdout, stderr, and execution time.',
  inputSchema: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'Python code to execute'
      },
      description: {
        type: 'string',
        description: 'What this code is intended to do (for transparency)'
      },
      working_directory: {
        type: 'string',
        description: 'Working directory for execution (optional)'
      }
    },
    required: ['code']
  },

  async *execute(args: any): AsyncGenerator<ToolResponse> {
    const { code, description, working_directory } = args;

    logger.info('Brain Execute requested:', {
      description: description || 'No description provided',
      workingDirectory: working_directory || 'default',
      codePreview: code.substring(0, 100) + (code.length > 100 ? '...' : '')
    });

    yield { 
      type: 'text', 
      text: `🐍 Executing Python code: ${description || 'No description provided'}` 
    };

    try {
      // If working directory specified, prepend cd command
      let finalCode = code;
      if (working_directory) {
        finalCode = `os.chdir('${working_directory}')\n${code}`;
      }

      // Execute the code
      const result = await executionModule.execute(finalCode, {
        description
      });

      // Yield output
      if (result.stdout) {
        yield { type: 'text', text: '\n📤 Output:' };
        yield { type: 'text', text: result.stdout };
      }

      if (result.stderr) {
        yield { type: 'text', text: '\n⚠️ Errors:' };
        yield { type: 'text', text: result.stderr };
      }

      yield { 
        type: 'text', 
        text: `\n⏱️ Execution time: ${result.executionTime}` 
      };

      // Log the execution details
      logger.info('Execution completed', {
        hasOutput: !!result.stdout,
        hasErrors: !!result.stderr,
        executionTime: result.executionTime
      });

    } catch (error: any) {
      logger.error('Brain Execute failed:', error);
      yield { 
        type: 'text', 
        text: `❌ Execution failed: ${error.message}` 
      };
    }
  }
};
