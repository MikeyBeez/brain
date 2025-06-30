/**
 * Brain Remember Tool
 * 
 * Store information in Brain's memory with automatic tiering.
 */

import { Tool, ToolResponse } from '../modules/types.js';
import { memoryModule } from '../modules/memory/index.js';
import { logger } from '../core/database.js';

export const brainRememberTool: Tool = {
  name: 'brain_remember',
  description: 'Store information in Brain memory (e.g., user preferences, project info, learnings)',
  inputSchema: {
    type: 'object',
    properties: {
      key: {
        type: 'string',
        description: 'Memory key (e.g., "user_preferences", "project_config", "learned_pattern")'
      },
      value: {
        type: ['object', 'string', 'number', 'boolean', 'array'],
        description: 'Value to remember'
      },
      type: {
        type: 'string',
        description: 'Memory type (e.g., "user_preferences", "project", "pattern", "general")',
        default: 'general'
      }
    },
    required: ['key', 'value']
  },
  
  async *execute(args: any): AsyncGenerator<ToolResponse> {
    try {
      const { key, value, type = 'general' } = args;
      
      yield { type: 'text', text: `💾 Storing memory: ${key}...` };
      
      // Initialize if needed
      memoryModule.initialize();
      
      // Store the memory
      memoryModule.set(key, value, type);
      
      // Special handling for certain types
      if (key === 'user_preferences') {
        yield { type: 'text', text: '✓ Updated user preferences' };
        yield { type: 'text', text: formatMemoryValue(value) };
      } else if (key === 'active_project') {
        yield { type: 'text', text: `✓ Set active project: ${value}` };
      } else {
        yield { type: 'text', text: `✓ Stored ${type} memory: ${key}` };
        if (typeof value === 'object') {
          yield { type: 'text', text: formatMemoryValue(value) };
        }
      }
      
      logger.info('Memory stored', { key, type });
    } catch (error: any) {
      logger.error('Failed to store memory', error);
      yield { type: 'text', text: `⚠️ Error: ${error.message}` };
    }
  }
};

/**
 * Format memory value for display
 */
function formatMemoryValue(value: any): string {
  if (typeof value === 'string') {
    return `  "${value}"`;
  }
  
  if (Array.isArray(value)) {
    return value.map(v => `  • ${JSON.stringify(v)}`).join('\n');
  }
  
  if (typeof value === 'object' && value !== null) {
    const lines = [];
    for (const [k, v] of Object.entries(value)) {
      lines.push(`  • ${k}: ${JSON.stringify(v)}`);
    }
    return lines.join('\n');
  }
  
  return `  ${JSON.stringify(value)}`;
}
