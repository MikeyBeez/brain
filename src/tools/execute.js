/**
 * Brain Execute Tool
 * 
 * Execute Python code with full system access and immediate feedback.
 * Provides transparent logging of all operations.
 */

import { executionModule } from '../modules/execution/index.js';
import { logger } from '../core/database.js';

export const brainExecuteTool = {
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

  async execute(args) {
    const { code, description, working_directory } = args;

    logger.info('Brain Execute requested:', {
      description: description || 'No description provided',
      workingDirectory: working_directory || 'default',
      codePreview: code.substring(0, 100) + (code.length > 100 ? '...' : '')
    });

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

      // Add description to result for transparency
      return {
        ...result,
        description: description || 'No description provided',
        code_executed: code
      };

    } catch (error) {
      logger.error('Brain Execute failed:', error);
      throw error;
    }
  }
};
