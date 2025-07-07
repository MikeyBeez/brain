/**
 * Obsidian Note Tool
 * 
 * CRUD operations for Obsidian notes integrated with Brain.
 */

import { Tool, ToolResponse } from '../modules/types.js';
import { logger } from '../core/database.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';

const execAsync = promisify(exec);

const PYTHON_PATH = '/Users/bard/Code/brain-notes/.venv/bin/python';
const TOOL_PATH = '/Users/bard/Code/brain-notes/obsidian_integration/obsidian_note.py';
const VAULT_PATH = '/Users/bard/Code/BrainVault';

export const obsidianNoteTool: Tool = {
  name: 'obsidian_note',
  description: 'Create, read, update, or delete notes in Obsidian vault',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['create', 'read', 'update', 'delete', 'list'],
        description: 'Action to perform'
      },
      title: {
        type: 'string',
        description: 'Note title (for create)'
      },
      content: {
        type: 'string',
        description: 'Note content (for create/update)'
      },
      identifier: {
        type: 'string',
        description: 'Note ID or path (for read/update/delete)'
      },
      metadata: {
        type: 'object',
        description: 'Note metadata (tags, etc.)'
      },
      folder: {
        type: 'string',
        description: 'Folder to list notes from'
      }
    },
    required: ['action']
  },

  async *execute(args: any): AsyncGenerator<ToolResponse> {
    try {
      const { action } = args;
      
      yield { type: 'text', text: `📝 Executing Obsidian ${action} action...` };
      
      // Build Python command based on action
      let pythonCode = '';
      
      switch (action) {
        case 'create':
          if (!args.title || !args.content) {
            throw new Error('Title and content required for create action');
          }
          pythonCode = `
import sys
sys.path.insert(0, '/Users/bard/Code/brain-notes')
from obsidian_integration.obsidian_note import ObsidianNote
import json

note_tool = ObsidianNote(vault_path="${VAULT_PATH}")
result = note_tool.create(
    title="${args.title.replace(/"/g, '\\"')}",
    content="""${args.content.replace(/"/g, '\\"')}""",
    metadata=${JSON.stringify(args.metadata || {})}
)
print(json.dumps(result))
`;
          break;
          
        case 'read':
          if (!args.identifier) {
            throw new Error('Identifier required for read action');
          }
          pythonCode = `
import sys
sys.path.insert(0, '/Users/bard/Code/brain-notes')
from obsidian_integration.obsidian_note import ObsidianNote
import json

note_tool = ObsidianNote(vault_path="${VAULT_PATH}")
result = note_tool.read("${args.identifier}")
print(json.dumps(result))
`;
          break;
          
        case 'update':
          if (!args.identifier) {
            throw new Error('Identifier required for update action');
          }
          pythonCode = `
import sys
sys.path.insert(0, '/Users/bard/Code/brain-notes')
from obsidian_integration.obsidian_note import ObsidianNote
import json

note_tool = ObsidianNote(vault_path="${VAULT_PATH}")
result = note_tool.update(
    "${args.identifier}",
    content="""${args.content || ''}""" if "${args.content}" else None,
    metadata_updates=${JSON.stringify(args.metadata || {})}
)
print(json.dumps(result))
`;
          break;
          
        case 'delete':
          if (!args.identifier) {
            throw new Error('Identifier required for delete action');
          }
          pythonCode = `
import sys
sys.path.insert(0, '/Users/bard/Code/brain-notes')
from obsidian_integration.obsidian_note import ObsidianNote
import json

note_tool = ObsidianNote(vault_path="${VAULT_PATH}")
result = note_tool.delete("${args.identifier}")
print(json.dumps(result))
`;
          break;
          
        case 'list':
          pythonCode = `
import sys
sys.path.insert(0, '/Users/bard/Code/brain-notes')
from obsidian_integration.obsidian_note import ObsidianNote
import json

note_tool = ObsidianNote(vault_path="${VAULT_PATH}")
result = note_tool.list_notes(folder="${args.folder || ''}" if "${args.folder}" else None)
print(json.dumps(result))
`;
          break;
          
        default:
          throw new Error(`Unknown action: ${action}`);
      }
      
      // Execute Python code
      const { stdout, stderr } = await execAsync(
        `${PYTHON_PATH} -c '${pythonCode.replace(/'/g, "'\"'\"'")}'`
      );
      
      if (stderr) {
        logger.error('Obsidian tool error', { stderr });
        yield { type: 'text', text: `⚠️ Warning: ${stderr}` };
      }
      
      // Parse result
      try {
        const result = JSON.parse(stdout);
        
        switch (action) {
          case 'create':
            yield { type: 'text', text: `✅ Created note: ${result.title}` };
            yield { type: 'text', text: `📍 Path: ${result.path}` };
            yield { type: 'text', text: `🔑 ID: ${result.id}` };
            break;
            
          case 'read':
            if (result) {
              yield { type: 'text', text: `📖 ${result.title}` };
              yield { type: 'text', text: `\n${result.content}` };
              if (result.metadata && Object.keys(result.metadata).length > 0) {
                yield { type: 'text', text: `\n📋 Metadata: ${JSON.stringify(result.metadata, null, 2)}` };
              }
            } else {
              yield { type: 'text', text: '❌ Note not found' };
            }
            break;
            
          case 'update':
            yield { type: 'text', text: `✅ Updated: ${result.path}` };
            yield { type: 'text', text: `🕐 Modified: ${result.modified}` };
            break;
            
          case 'delete':
            yield { type: 'text', text: `🗑️ Deleted: ${result.path}` };
            yield { type: 'text', text: `📁 Moved to: ${result.trash_path}` };
            break;
            
          case 'list':
            yield { type: 'text', text: `📚 Found ${result.length} notes:` };
            for (const note of result.slice(0, 20)) {
              yield { type: 'text', text: `  • ${note.name} (${note.path})` };
            }
            if (result.length > 20) {
              yield { type: 'text', text: `  ... and ${result.length - 20} more` };
            }
            break;
        }
        
      } catch (parseError) {
        logger.error('Failed to parse Obsidian result', { stdout, parseError });
        yield { type: 'text', text: stdout };
      }
      
    } catch (error: any) {
      logger.error('Obsidian tool failed', error);
      yield { type: 'text', text: `❌ Error: ${error.message}` };
    }
  }
};
