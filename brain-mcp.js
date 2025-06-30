#!/usr/bin/env node

/**
 * Brain MCP Server Launcher
 * 
 * This script properly initializes and starts the Brain MCP server
 * with correct error handling and environment setup.
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Change to project root
process.chdir(__dirname);

// Ensure data directory exists
const dataDir = process.env.BRAIN_DATA_DIR || join(__dirname, 'data');
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

// Import and start the server
try {
  await import('./dist/index.js');
} catch (error) {
  console.error('Failed to start Brain MCP server:', error.message);
  console.error('Please ensure you have run "npm run build" first.');
  process.exit(1);
}
