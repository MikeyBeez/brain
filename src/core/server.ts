/**
 * Brain MCP Server
 * 
 * Main server that exposes Brain's capabilities via Model Context Protocol.
 * Uses async generators for streaming responses.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { Tool } from '../modules/types.js';
import { logger } from './database.js';
import { BrainModules } from '../modules/types.js';

export class BrainServer {
  private server: Server;
  private modules: Partial<BrainModules> = {};
  private tools: Map<string, Tool> = new Map();
  
  constructor() {
    this.server = new Server({
      name: 'brain',
      version: '1.0.0'
    }, {
      capabilities: {
        tools: {}
      }
    });
    
    this.setupErrorHandling();
    this.setupHandlers();
  }
  
  /**
   * Set up request handlers
   */
  private setupHandlers(): void {
    // List tools handler
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: Array.from(this.tools.values()).map(t => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema
      }))
    }));
    
    // Call tool handler
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const tool = this.tools.get(name);
      
      if (!tool) {
        return {
          content: [{
            type: 'text',
            text: `Unknown tool: ${name}`
          }]
        };
      }
      
      try {
        const messages = [];
        for await (const response of tool.execute(args)) {
          messages.push(response);
        }
        
        return {
          content: messages
        };
      } catch (error: any) {
        logger.error(`Error executing tool ${name}`, error);
        return {
          content: [{
            type: 'text',
            text: `⚠️ Error: ${error.message}`
          }]
        };
      }
    });
  }
  
  /**
   * Register a module with the server
   */
  registerModule(name: keyof BrainModules, module: any): void {
    this.modules[name] = module;
    logger.info(`Registered module: ${name}`);
  }
  
  /**
   * Register a tool with the server
   */
  registerTool(tool: Tool): void {
    this.tools.set(tool.name, tool);
    logger.info(`Registered tool: ${tool.name}`);
  }
  
  /**
   * Set up error handling
   */
  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      logger.error('MCP Server error', error);
    };
    
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', error);
      process.exit(1);
    });
    
    process.on('unhandledRejection', (error) => {
      logger.error('Unhandled rejection', error);
      process.exit(1);
    });
  }
  
  /**
   * Start the server
   */
  async start(): Promise<void> {
    // Start the transport
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    
    logger.info('Brain MCP server started');
  }
  
  /**
   * Get registered modules
   */
  getModules(): Partial<BrainModules> {
    return this.modules;
  }
}

// Create and export server instance
export const brainServer = new BrainServer();
