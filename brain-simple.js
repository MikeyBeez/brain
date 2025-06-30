#!/usr/bin/env node

// Simple Brain MCP Server - Direct approach
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

// Create server with basic setup
const server = new Server({
  name: 'brain-simple',
  version: '1.0.0'
}, {
  capabilities: {
    tools: {}
  }
});

// Simple in-memory storage
const memories = new Map();

// Add basic tools
server.setRequestHandler('tools/list', async () => ({
  tools: [
    {
      name: 'brain:remember',
      description: 'Store a memory',
      inputSchema: {
        type: 'object',
        properties: {
          key: { type: 'string' },
          value: { type: 'string' }
        },
        required: ['key', 'value']
      }
    },
    {
      name: 'brain:recall',
      description: 'Retrieve a memory',
      inputSchema: {
        type: 'object',
        properties: {
          key: { type: 'string' }
        },
        required: ['key']
      }
    },
    {
      name: 'brain:status',
      description: 'Check brain status',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    }
  ]
}));

// Handle tool calls
server.setRequestHandler('tools/call', async (request) => {
  const { name, arguments: args } = request.params;
  
  switch (name) {
    case 'brain:remember':
      memories.set(args.key, args.value);
      return {
        content: [{
          type: 'text',
          text: `✓ Remembered: ${args.key}`
        }]
      };
      
    case 'brain:recall':
      const value = memories.get(args.key);
      return {
        content: [{
          type: 'text',
          text: value ? `Memory: ${value}` : `No memory found for: ${args.key}`
        }]
      };
      
    case 'brain:status':
      return {
        content: [{
          type: 'text',
          text: `Brain Status: Active\nMemories stored: ${memories.size}`
        }]
      };
      
    default:
      return {
        content: [{
          type: 'text',
          text: `Unknown tool: ${name}`
        }]
      };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Brain MCP server (simple) started');
}

main().catch(error => {
  console.error('Failed to start:', error);
  process.exit(1);
});
