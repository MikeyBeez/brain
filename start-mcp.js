#!/usr/bin/env node

/**
 * Brain MCP Startup Script
 * This script ensures proper startup of the Brain MCP server
 */

import { spawn } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = __dirname;

// Change to project directory
process.chdir(projectRoot);

// Ensure data directory exists with absolute path
const dataDir = process.env.BRAIN_DATA_DIR || join(projectRoot, 'data');
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
  console.error(`Created data directory: ${dataDir}`);
}

// Check if dist/index.js exists
const distPath = join(projectRoot, 'dist', 'index.js');
if (!existsSync(distPath)) {
  console.error('dist/index.js not found. Please run "npm run build" first.');
  process.exit(1);
}

// Start the server with proper stdio handling
console.error('Starting Brain MCP server...');
const server = spawn('node', [distPath], {
  stdio: ['inherit', 'inherit', 'inherit'],
  env: {
    ...process.env,
    BRAIN_DATA_DIR: dataDir
  }
});

server.on('error', (err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

server.on('exit', (code) => {
  console.error(`Server exited with code ${code}`);
  process.exit(code || 0);
});
