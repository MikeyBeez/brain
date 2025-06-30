/**
 * Brain Initialization Tool
 * 
 * Initializes a session and loads context including user preferences,
 * active project, and recent memories.
 */

import { Tool, ToolResponse, BrainContext } from '../modules/types.js';
import { memoryModule } from '../modules/memory/index.js';
import { sessionsModule } from '../modules/sessions/index.js';
import { logger } from '../core/database.js';

export const brainInitTool: Tool = {
  name: 'brain_init',
  description: 'Initialize Brain session and load context (user preferences, project info, recent memories)',
  inputSchema: {
    type: 'object',
    properties: {
      reload: {
        type: 'boolean',
        description: 'Force reload of context even if session exists'
      }
    }
  },
  
  async *execute(args: any): AsyncGenerator<ToolResponse> {
    try {
      yield { type: 'text', text: '🧠 Initializing Brain...' };
      
      // Initialize modules
      memoryModule.initialize();
      sessionsModule.initialize();
      
      // Get or create session
      const sessionId = sessionsModule.getOrCreateForUser();
      const session = sessionsModule.get(sessionId);
      
      if (!session) {
        yield { type: 'text', text: '⚠️ Error: Failed to create session' };
        return;
      }
      
      const isNewSession = (Date.now() - session.started_at.getTime()) < 1000;
      
      yield { 
        type: 'text', 
        text: isNewSession ? '✓ Created new session' : '✓ Resumed existing session' 
      };
      
      // Load user preferences
      yield { type: 'text', text: '📋 Loading user preferences...' };
      const preferences = memoryModule.get('user_preferences');
      
      // Load active project
      yield { type: 'text', text: '📁 Detecting active project...' };
      const activeProject = memoryModule.get('active_project');
      
      // Load recent memories (hot tier)
      yield { type: 'text', text: '💭 Loading recent memories...' };
      const recentMemories = memoryModule.getInitMemories();
      
      // Build context
      const context: BrainContext = {
        session_id: sessionId,
        status: isNewSession ? 'new' : 'resumed',
        user: process.env.USER || 'default',
        context: {
          preferences,
          active_project: activeProject,
          recent_memories: recentMemories.slice(0, 50) // Sample for display
        },
        loaded_memories: recentMemories.length,
        suggestions: generateSuggestions(preferences, activeProject)
      };
      
      // Update session with context
      sessionsModule.update(sessionId, { brain_context: context });
      
      // Format output
      yield { type: 'text', text: '\n✅ Brain initialized successfully!\n' };
      yield { type: 'text', text: `📊 Session: ${sessionId} (${context.status})` };
      yield { type: 'text', text: `👤 User: ${context.user}` };
      yield { type: 'text', text: `💾 Loaded ${context.loaded_memories} memories` };
      
      if (preferences) {
        yield { type: 'text', text: '\n🎯 User Preferences:' };
        yield { type: 'text', text: formatPreferences(preferences) };
      }
      
      if (activeProject) {
        yield { type: 'text', text: `\n📁 Active Project: ${activeProject}` };
      }
      
      if (context.suggestions.length > 0) {
        yield { type: 'text', text: '\n💡 Suggestions:' };
        for (const suggestion of context.suggestions) {
          yield { type: 'text', text: `  • ${suggestion}` };
        }
      }
      
      logger.info('Brain initialized', { sessionId, isNewSession });
    } catch (error: any) {
      logger.error('Brain initialization failed', error);
      yield { type: 'text', text: `⚠️ Error: ${error.message}` };
    }
  }
};

/**
 * Generate suggestions based on context
 */
function generateSuggestions(preferences: any, activeProject: string | null): string[] {
  const suggestions = [];
  
  if (!preferences) {
    suggestions.push('Set your preferences with brain_remember user_preferences {...}');
  }
  
  if (!activeProject) {
    suggestions.push('Set active project with brain_remember active_project "path/to/project"');
  }
  
  if (preferences?.language === 'Python') {
    suggestions.push('Try brain_execute to run Python code');
  }
  
  suggestions.push('Use brain_recall to search your memories');
  suggestions.push('Use brain_note to create notes');
  
  return suggestions.slice(0, 5);
}

/**
 * Format preferences for display
 */
function formatPreferences(prefs: any): string {
  if (typeof prefs === 'string') {
    return `  ${prefs}`;
  }
  
  const lines = [];
  for (const [key, value] of Object.entries(prefs)) {
    lines.push(`  • ${key}: ${JSON.stringify(value)}`);
  }
  return lines.join('\n');
}
