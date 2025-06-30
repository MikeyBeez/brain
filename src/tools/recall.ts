/**
 * Brain Recall Tool
 * 
 * Search through stored memories using full-text search.
 */

import { Tool, ToolResponse } from '../modules/types.js';
import { memoryModule } from '../modules/memory/index.js';
import { logger } from '../core/database.js';

export const brainRecallTool: Tool = {
  name: 'brain_recall',
  description: 'Search through Brain memories to recall information',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query (searches keys and values)'
      },
      limit: {
        type: 'number',
        description: 'Maximum results to return',
        default: 10
      }
    },
    required: ['query']
  },
  
  async *execute(args: any): AsyncGenerator<ToolResponse> {
    try {
      const { query, limit = 10 } = args;
      
      yield { type: 'text', text: `🔍 Searching memories for: "${query}"...` };
      
      // Initialize if needed
      memoryModule.initialize();
      
      // Search memories
      const results = memoryModule.search(query, limit);
      
      if (results.length === 0) {
        yield { type: 'text', text: '❌ No memories found matching your query.' };
        yield { type: 'text', text: '\n💡 Tips:' };
        yield { type: 'text', text: '  • Try different keywords' };
        yield { type: 'text', text: '  • Use partial words for broader matches' };
        yield { type: 'text', text: '  • Check brain_status for memory stats' };
        return;
      }
      
      yield { type: 'text', text: `\n✓ Found ${results.length} matching memories:\n` };
      
      for (const result of results) {
        yield { type: 'text', text: `📌 ${result.key} (score: ${result.score.toFixed(2)})` };
        yield { type: 'text', text: formatResultValue(result.value) };
        yield { type: 'text', text: '' }; // Empty line between results
      }
      
      logger.info('Memory search completed', { query, resultCount: results.length });
    } catch (error: any) {
      logger.error('Memory search failed', error);
      yield { type: 'text', text: `⚠️ Error: ${error.message}` };
    }
  }
};

/**
 * Format search result value for display
 */
function formatResultValue(value: any): string {
  if (typeof value === 'string') {
    // Truncate long strings
    const truncated = value.length > 200 ? value.substring(0, 200) + '...' : value;
    return `   "${truncated}"`;
  }
  
  if (Array.isArray(value)) {
    const preview = value.slice(0, 3);
    const items = preview.map(v => `   • ${JSON.stringify(v)}`).join('\n');
    if (value.length > 3) {
      return items + `\n   ... and ${value.length - 3} more items`;
    }
    return items;
  }
  
  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value);
    const preview = entries.slice(0, 5);
    const lines = preview.map(([k, v]) => {
      const valueStr = JSON.stringify(v);
      const truncated = valueStr.length > 50 ? valueStr.substring(0, 50) + '...' : valueStr;
      return `   • ${k}: ${truncated}`;
    });
    
    if (entries.length > 5) {
      lines.push(`   ... and ${entries.length - 5} more fields`);
    }
    
    return lines.join('\n');
  }
  
  return `   ${JSON.stringify(value)}`;
}
