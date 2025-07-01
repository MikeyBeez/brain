/**
 * Brain Execute Tool
 * 
 * Execute code with automatic language detection or explicit language specification.
 * Supports Python and Shell commands with full system access.
 * Provides transparent logging of all operations.
 */

import { Tool, ToolResponse } from '../modules/types.js';
import { executionModule } from '../modules/execution/index.js';
import { logger } from '../core/database.js';

export const brainExecuteTool: Tool = {
  name: 'brain_execute',
  description: 'Execute Python or Shell code with full system access. Auto-detects language or use explicit language parameter. Returns stdout, stderr, and execution time.',
  inputSchema: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'Code to execute (Python or Shell commands)'
      },
      description: {
        type: 'string',
        description: 'What this code is intended to do (for transparency)'
      },
      language: {
        type: 'string',
        enum: ['python', 'shell', 'auto'],
        default: 'auto',
        description: 'Language to use: "python", "shell", or "auto" for automatic detection'
      },
      working_directory: {
        type: 'string',
        description: 'Working directory for execution (optional)'
      }
    },
    required: ['code']
  },

  async *execute(args: any): AsyncGenerator<ToolResponse> {
    const { code, description, language = 'auto', working_directory } = args;

    logger.info('Brain Execute requested:', {
      description: description || 'No description provided',
      language,
      workingDirectory: working_directory || 'default',
      codePreview: code.substring(0, 100) + (code.length > 100 ? '...' : '')
    });

    // Determine language icon
    const languageIcon = language === 'shell' ? '🐚' : 
                        language === 'python' ? '🐍' : 
                        '🤖'; // Auto-detect

    yield { 
      type: 'text', 
      text: `${languageIcon} Executing ${language === 'auto' ? 'code (auto-detecting language)' : language + ' code'}: ${description || 'No description provided'}` 
    };

    try {
      // Handle working directory for different languages
      let finalCode = code;
      if (working_directory) {
        if (language === 'shell' || (language === 'auto' && code.trim().split('\n').length === 1)) {
          // For shell commands, prepend cd
          finalCode = `cd '${working_directory}' && ${code}`;
        } else {
          // For Python, use os.chdir
          finalCode = `import os\nos.chdir('${working_directory}')\n${code}`;
        }
      }

      // Execute the code
      const result = await executionModule.execute(finalCode, {
        description,
        language: language as 'python' | 'shell' | 'auto'
      });

      // Show detected language if auto-detected
      if (language === 'auto' && result.language) {
        yield { 
          type: 'text', 
          text: `\n🔍 Detected language: ${result.language}` 
        };
      }

      // Yield output
      if (result.stdout) {
        yield { type: 'text', text: '\n📤 Output:' };
        yield { type: 'text', text: result.stdout };
      }

      if (result.stderr) {
        yield { type: 'text', text: '\n⚠️ Errors:' };
        yield { type: 'text', text: result.stderr };
      }

      // Show exit code for shell commands
      if (result.exitCode !== undefined && result.language === 'shell') {
        yield { 
          type: 'text', 
          text: `\n📊 Exit code: ${result.exitCode}` 
        };
      }

      yield { 
        type: 'text', 
        text: `\n⏱️ Execution time: ${result.executionTime}` 
      };

      // Log the execution details
      logger.info('Execution completed', {
        hasOutput: !!result.stdout,
        hasErrors: !!result.stderr,
        executionTime: result.executionTime,
        language: result.language,
        exitCode: result.exitCode
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
