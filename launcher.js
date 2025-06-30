#!/usr/bin/env node

/**
 * Brain MCP Launcher
 * Ensures proper environment setup before starting Brain
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Change to Brain directory
const brainDir = '/Users/bard/Code/brain';
process.chdir(brainDir);

// Ensure data directory exists
const dataDir = path.join(brainDir, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Set environment
process.env.BRAIN_DATA_DIR = dataDir;

// Start Brain server
const brain = spawn('node', ['dist/index.js'], {
  stdio: 'inherit',
  env: process.env
});

brain.on('error', (err) => {
  console.error('Failed to start Brain:', err);
  process.exit(1);
});

brain.on('exit', (code) => {
  process.exit(code);
});
