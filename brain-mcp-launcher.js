#!/usr/bin/env node

/**
 * Brain MCP Server Launcher
 * Handles all startup issues properly
 */

import { spawn } from 'child_process';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Change to project directory FIRST
process.chdir(__dirname);

// Ensure all required directories exist
const dirs = ['data', 'logs', 'dist'];
dirs.forEach(dir => {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
});

// Set environment variable with absolute path
process.env.BRAIN_DATA_DIR = join(__dirname, 'data');

// Check if we need to rebuild
const checkRebuild = () => {
  try {
    // Try to load better-sqlite3 to check if it's compatible
    const testProcess = spawn('node', ['-e', "require('better-sqlite3')"], {
      cwd: __dirname,
      stdio: 'pipe'
    });
    
    return new Promise((resolve) => {
      testProcess.on('error', () => resolve(true));
      testProcess.on('exit', (code) => resolve(code !== 0));
    });
  } catch {
    return Promise.resolve(true);
  }
};

async function main() {
  // Check if native modules need rebuilding
  const needsRebuild = await checkRebuild();
  if (needsRebuild) {
    console.error('Brain: Rebuilding native modules...');
    const rebuild = spawn('npm', ['rebuild', 'better-sqlite3'], {
      cwd: __dirname,
      stdio: ['ignore', 'ignore', 'inherit']
    });
    
    await new Promise((resolve) => {
      rebuild.on('exit', resolve);
    });
  }

  // Check if TypeScript build is needed
  if (!existsSync(join(__dirname, 'dist', 'index.js'))) {
    console.error('Brain: Building project...');
    
    // Clean dist directory first
    if (existsSync('dist')) {
      rmSync('dist', { recursive: true, force: true });
      mkdirSync('dist');
    }
    
    const build = spawn('npm', ['run', 'build'], {
      cwd: __dirname,
      stdio: ['ignore', 'ignore', 'inherit'] // Only errors to stderr
    });
    
    const buildCode = await new Promise((resolve) => {
      build.on('exit', resolve);
    });
    
    if (buildCode !== 0) {
      console.error('Brain: Build failed!');
      process.exit(1);
    }
  }

  // Now start the actual server
  try {
    console.error('Brain: Starting server...');
    await import('./dist/index.js');
  } catch (error) {
    console.error('Brain: Failed to start:', error.message);
    process.exit(1);
  }
}

// Handle errors
process.on('uncaughtException', (error) => {
  console.error('Brain: Uncaught exception:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (error) => {
  console.error('Brain: Unhandled rejection:', error.message);
  process.exit(1);
});

// Start
main();
