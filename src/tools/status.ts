/**
 * Brain Status Tool
 * 
 * Check Brain system status and health.
 */

import { Tool, ToolResponse, BrainStatus } from '../modules/types.js';
import { memoryModule } from '../modules/memory/index.js';
import { sessionsModule } from '../modules/sessions/index.js';
import { DatabaseConnection, logger } from '../core/database.js';

export const brainStatusTool: Tool = {
  name: 'brain_status',
  description: 'Check Brain system status, health, and statistics',
  inputSchema: {
    type: 'object',
    properties: {
      detailed: {
        type: 'boolean',
        description: 'Show detailed statistics',
        default: false
      }
    }
  },
  
  async *execute(args: any): AsyncGenerator<ToolResponse> {
    try {
      const { detailed = false } = args;
      
      yield { type: 'text', text: '🧠 Brain System Status\n' };
      
      // Check if initialized
      const sessionStats = sessionsModule.getStats();
      const hasActiveSession = sessionStats.active > 0;
      
      const status: BrainStatus = {
        status: hasActiveSession ? 'active' : 'not_initialized'
      };
      
      // Basic status
      yield { type: 'text', text: `📊 Status: ${status.status}` };
      yield { type: 'text', text: `🔌 Database: Connected` };
      
      // Session info
      yield { type: 'text', text: `\n📋 Sessions:` };
      yield { type: 'text', text: `  • Active: ${sessionStats.active}` };
      yield { type: 'text', text: `  • Total: ${sessionStats.total}` };
      
      // Database health
      const integrity = DatabaseConnection.checkIntegrity();
      yield { type: 'text', text: `\n🏥 Database Health: ${integrity.healthy ? '✅ Healthy' : '⚠️ Issues detected'}` };
      
      if (!integrity.healthy && integrity.issues) {
        for (const issue of integrity.issues) {
          yield { type: 'text', text: `  ⚠️ ${issue}` };
        }
      }
      
      // Memory statistics
      const memStats = getMemoryStats();
      yield { type: 'text', text: `\n💾 Memory Statistics:` };
      yield { type: 'text', text: `  • Total memories: ${memStats.total}` };
      yield { type: 'text', text: `  • Hot tier: ${memStats.hot} memories` };
      yield { type: 'text', text: `  • Warm tier: ${memStats.warm} memories` };
      yield { type: 'text', text: `  • Cold tier: ${memStats.cold} memories` };
      
      if (detailed) {
        // Database statistics
        const dbStats = DatabaseConnection.getStats();
        yield { type: 'text', text: `\n🗄️ Database Details:` };
        yield { type: 'text', text: `  • Size: ${formatBytes((dbStats as any).page_count * (dbStats as any).page_size)}` };
        yield { type: 'text', text: `  • Cache: ${Math.abs((dbStats as any).cache_size)} pages` };
        yield { type: 'text', text: `  • Journal mode: ${(dbStats as any).journal_mode}` };
        
        // System info
        yield { type: 'text', text: `\n⚙️ System Info:` };
        yield { type: 'text', text: `  • Node.js: ${process.version}` };
        yield { type: 'text', text: `  • Platform: ${process.platform}` };
        yield { type: 'text', text: `  • Uptime: ${formatUptime(process.uptime())}` };
        yield { type: 'text', text: `  • Memory usage: ${formatBytes(process.memoryUsage().heapUsed)}` };
      }
      
      logger.info('Status check completed', { status: status.status });
    } catch (error: any) {
      logger.error('Status check failed', error);
      yield { type: 'text', text: `⚠️ Error: ${error.message}` };
    }
  }
};

/**
 * Get memory statistics from database
 */
function getMemoryStats(): { total: number; hot: number; warm: number; cold: number } {
  try {
    const db = DatabaseConnection.getInstance();
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN storage_tier = 'hot' THEN 1 ELSE 0 END) as hot,
        SUM(CASE WHEN storage_tier = 'warm' THEN 1 ELSE 0 END) as warm,
        SUM(CASE WHEN storage_tier = 'cold' THEN 1 ELSE 0 END) as cold
      FROM memories
    `).get() as any;
    
    return {
      total: stats.total || 0,
      hot: stats.hot || 0,
      warm: stats.warm || 0,
      cold: stats.cold || 0
    };
  } catch (error) {
    logger.error('Failed to get memory stats', error);
    return { total: 0, hot: 0, warm: 0, cold: 0 };
  }
}

/**
 * Format bytes to human readable
 */
function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * Format uptime to human readable
 */
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  
  return parts.join(' ') || '< 1m';
}
