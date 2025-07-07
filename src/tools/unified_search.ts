/**
 * Unified Search Tool
 * 
 * Search across both Brain and Obsidian with intelligent ranking.
 */

import { Tool, ToolResponse } from '../modules/types.js';
import { logger } from '../core/database.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const PYTHON_PATH = '/Users/bard/Code/brain-notes/.venv/bin/python';

export const unifiedSearchTool: Tool = {
  name: 'unified_search',
  description: 'Search across both Brain memory and Obsidian notes',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query'
      },
      limit: {
        type: 'number',
        description: 'Maximum results to return',
        default: 20
      },
      source: {
        type: 'string',
        enum: ['all', 'brain', 'obsidian'],
        description: 'Search in specific source or all',
        default: 'all'
      }
    },
    required: ['query']
  },

  async *execute(args: any): AsyncGenerator<ToolResponse> {
    try {
      const { query, limit = 20, source = 'all' } = args;
      
      yield { type: 'text', text: `🔍 Searching for: "${query}"...` };
      
      const pythonCode = `
import sys
sys.path.insert(0, '/Users/bard/Code/brain-notes')
from obsidian_integration.unified_search import UnifiedSearch
import json

searcher = UnifiedSearch()
results = searcher.search("${query.replace(/"/g, '\\"')}", limit=${limit})

# Filter by source if requested
if "${source}" == "brain":
    output = {"brain": results["brain"], "merged": results["brain"]}
elif "${source}" == "obsidian":
    output = {"obsidian": results["obsidian"], "merged": results["obsidian"]}
else:
    output = results

# Simplify output for display
summary = {
    "brain_count": len(results["brain"]),
    "obsidian_count": len(results["obsidian"]),
    "merged_count": len(results["merged"]),
    "merged_results": output["merged"][:10]  # Top 10
}

print(json.dumps(summary, indent=2))
`;
      
      // Execute search
      const { stdout, stderr } = await execAsync(
        `${PYTHON_PATH} -c '${pythonCode.replace(/'/g, "'\"'\"'")}'`
      );
      
      if (stderr && !stderr.includes('Error searching Brain')) {
        logger.error('Unified search error', { stderr });
      }
      
      try {
        const results = JSON.parse(stdout);
        
        // Summary
        yield { type: 'text', text: `\n📊 Results: ${results.brain_count} Brain | ${results.obsidian_count} Obsidian | ${results.merged_count} Total` };
        
        // Display merged results
        if (results.merged_results && results.merged_results.length > 0) {
          yield { type: 'text', text: '\n🔝 Top Results:' };
          
          for (const [index, result] of results.merged_results.entries()) {
            const num = index + 1;
            const score = result.final_score?.toFixed(3) || 'N/A';
            
            if (result.source === 'brain') {
              yield { type: 'text', text: `\n${num}. 🧠 Brain: ${result.key} (score: ${score})` };
              if (result.value && typeof result.value === 'object') {
                const preview = JSON.stringify(result.value).substring(0, 200);
                yield { type: 'text', text: `   ${preview}...` };
              }
            } else if (result.source === 'obsidian') {
              yield { type: 'text', text: `\n${num}. 📝 Obsidian: ${result.title} (score: ${score})` };
              yield { type: 'text', text: `   📍 ${result.path}` };
              if (result.content_preview) {
                yield { type: 'text', text: `   ${result.content_preview}` };
              }
            }
          }
        } else {
          yield { type: 'text', text: '\n❌ No results found' };
        }
        
      } catch (parseError) {
        logger.error('Failed to parse search results', { stdout, parseError });
        yield { type: 'text', text: '⚠️ Search completed but failed to parse results' };
      }
      
    } catch (error: any) {
      logger.error('Unified search failed', error);
      yield { type: 'text', text: `❌ Error: ${error.message}` };
    }
  }
};
