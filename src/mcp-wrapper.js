#!/usr/bin/env node

// Brain MCP Wrapper Script
// This ensures Brain runs from the correct directory

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

// Change to project directory
process.chdir(projectRoot);

// Set environment variables
process.env.BRAIN_DATA_DIR = process.env.BRAIN_DATA_DIR || join(projectRoot, 'data');

// Import and run the main server
import('../dist/index.js');
