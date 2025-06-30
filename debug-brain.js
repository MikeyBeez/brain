#!/usr/bin/env node

// Simple debug script to test Brain startup
import { existsSync } from 'fs';
import { join } from 'path';

console.error('Brain Debug Script');
console.error('==================');
console.error('Working directory:', process.cwd());
console.error('BRAIN_DATA_DIR:', process.env.BRAIN_DATA_DIR);
console.error('Node version:', process.version);

// Check if dist exists
const distPath = join(process.cwd(), 'dist', 'index.js');
console.error('Checking dist/index.js:', distPath);
console.error('Exists:', existsSync(distPath));

// Try to import and run
try {
  console.error('\nAttempting to import dist/index.js...');
  await import('./dist/index.js');
} catch (error) {
  console.error('Import failed:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
}
