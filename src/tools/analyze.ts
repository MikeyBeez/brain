/**
 * Brain Analyze Tool
 * 
 * AI-powered analysis of vault structure, connections, and insights.
 */

import { Tool, ToolResponse } from '../modules/types.js';
import { logger } from '../core/database.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const PYTHON_PATH = '/Users/bard/Code/brain-notes/.venv/bin/python';
const VAULT_PATH = '/Users/bard/Code/BrainVault';

export const brainAnalyzeTool: Tool = {
  name: 'brain_analyze',
  description: 'Analyze Obsidian vault for insights, connections, and patterns',
  inputSchema: {
    type: 'object',
    properties: {
      analysis_type: {
        type: 'string',
        enum: ['full', 'connections', 'orphans', 'patterns', 'insights'],
        description: 'Type of analysis to perform',
        default: 'full'
      },
      save_report: {
        type: 'boolean',
        description: 'Save analysis report to vault',
        default: false
      }
    }
  },

  async *execute(args: any): AsyncGenerator<ToolResponse> {
    try {
      const { analysis_type = 'full', save_report = false } = args;
      
      yield { type: 'text', text: `🧠 Analyzing vault (${analysis_type} analysis)...` };
      
      const pythonCode = `
import sys
sys.path.insert(0, '/Users/bard/Code/brain-notes')
from obsidian_integration.brain_analyze import BrainAnalyze
import json

analyzer = BrainAnalyze(vault_path="${VAULT_PATH}")

if "${analysis_type}" == "full":
    results = analyzer.analyze_vault()
    
    # Create summary
    summary = {
        "stats": results["stats"],
        "insights": results["insights"],
        "orphan_count": len(results["orphans"]),
        "hub_count": len(results["hubs"]),
        "top_hubs": results["hubs"][:5],
        "suggestion_count": len(results["suggestions"]),
        "top_suggestions": results["suggestions"][:5],
        "patterns": {
            "top_tags": results["patterns"].get("top_tags", [])[:5],
            "most_referenced": results["patterns"].get("most_referenced", [])[:5]
        }
    }
    
    if ${save_report}:
        report = analyzer.generate_report(
            output_path="${VAULT_PATH}/VAULT_ANALYSIS_REPORT.md"
        )
        summary["report_saved"] = True
        
    print(json.dumps(summary, indent=2))
    
elif "${analysis_type}" == "connections":
    results = analyzer.analyze_vault()
    suggestions = results["suggestions"][:10]
    print(json.dumps({"suggestions": suggestions}, indent=2))
    
elif "${analysis_type}" == "orphans":
    results = analyzer.analyze_vault()
    orphans = results["orphans"][:20]
    print(json.dumps({"orphans": orphans, "total": len(results["orphans"])}, indent=2))
    
elif "${analysis_type}" == "patterns":
    results = analyzer.analyze_vault()
    print(json.dumps(results["patterns"], indent=2))
    
elif "${analysis_type}" == "insights":
    results = analyzer.analyze_vault()
    print(json.dumps({"insights": results["insights"]}, indent=2))
`;
      
      // Execute analysis
      const { stdout, stderr } = await execAsync(
        `${PYTHON_PATH} -c '${pythonCode.replace(/'/g, "'\"'\"'")}'`,
        { maxBuffer: 1024 * 1024 * 10 } // 10MB buffer for large results
      );
      
      if (stderr) {
        logger.error('Brain analyze error', { stderr });
      }
      
      try {
        const results = JSON.parse(stdout);
        
        switch (analysis_type) {
          case 'full':
            // Stats
            yield { type: 'text', text: '\n📊 Vault Statistics:' };
            yield { type: 'text', text: `  • Total Notes: ${results.stats.total_notes}` };
            yield { type: 'text', text: `  • Total Words: ${results.stats.total_words.toLocaleString()}` };
            yield { type: 'text', text: `  • Total Links: ${results.stats.total_links}` };
            yield { type: 'text', text: `  • Avg Links/Note: ${results.stats.avg_links_per_note.toFixed(1)}` };
            
            // Insights
            if (results.insights && results.insights.length > 0) {
              yield { type: 'text', text: '\n💡 Key Insights:' };
              for (const insight of results.insights) {
                yield { type: 'text', text: `  ${insight}` };
              }
            }
            
            // Top hubs
            if (results.top_hubs && results.top_hubs.length > 0) {
              yield { type: 'text', text: '\n🌟 Most Connected Notes:' };
              for (const [path, connections] of results.top_hubs) {
                yield { type: 'text', text: `  • ${path}: ${connections} connections` };
              }
            }
            
            // Summary
            yield { type: 'text', text: `\n📝 Summary:` };
            yield { type: 'text', text: `  • ${results.orphan_count} orphan notes` };
            yield { type: 'text', text: `  • ${results.hub_count} hub notes` };
            yield { type: 'text', text: `  • ${results.suggestion_count} connection suggestions` };
            
            if (results.report_saved) {
              yield { type: 'text', text: '\n✅ Full report saved to VAULT_ANALYSIS_REPORT.md' };
            }
            break;
            
          case 'connections':
            yield { type: 'text', text: '\n🔗 Connection Suggestions:' };
            for (const [index, suggestion] of results.suggestions.entries()) {
              yield { type: 'text', text: `\n${index + 1}. ${suggestion.note1} ↔ ${suggestion.note2}` };
              yield { type: 'text', text: `   Reason: ${suggestion.reason}` };
            }
            break;
            
          case 'orphans':
            yield { type: 'text', text: `\n🏝️ Orphan Notes (${results.total} total):` };
            for (const orphan of results.orphans) {
              yield { type: 'text', text: `  • ${orphan}` };
            }
            break;
            
          case 'patterns':
            yield { type: 'text', text: '\n📈 Vault Patterns:' };
            if (results.top_tags) {
              yield { type: 'text', text: '\nMost Used Tags:' };
              for (const [tag, count] of results.top_tags) {
                yield { type: 'text', text: `  • #${tag} (${count} uses)` };
              }
            }
            if (results.most_referenced) {
              yield { type: 'text', text: '\nMost Referenced Notes:' };
              for (const [note, count] of results.most_referenced) {
                yield { type: 'text', text: `  • [[${note}]] (${count} references)` };
              }
            }
            break;
            
          case 'insights':
            yield { type: 'text', text: '\n💡 Vault Insights:' };
            for (const insight of results.insights) {
              yield { type: 'text', text: `\n${insight}` };
            }
            break;
        }
        
      } catch (parseError) {
        logger.error('Failed to parse analysis results', { stdout, parseError });
        yield { type: 'text', text: '⚠️ Analysis completed but failed to parse results' };
      }
      
    } catch (error: any) {
      logger.error('Brain analyze failed', error);
      yield { type: 'text', text: `❌ Error: ${error.message}` };
    }
  }
};
