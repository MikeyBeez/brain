#!/usr/bin/env node

// Simple test to run brain build
import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';

console.log('Testing Brain build process...\n');

// Change to brain directory
process.chdir('/Users/bard/Code/brain');
console.log('Working directory:', process.cwd());

// Check if TypeScript is installed
if (!existsSync('node_modules/typescript')) {
  console.error('TypeScript not found! Running npm install...');
  try {
    execSync('npm install', { stdio: 'inherit' });
  } catch (e) {
    console.error('npm install failed:', e.message);
    process.exit(1);
  }
}

// Run the build
console.log('\nRunning TypeScript build...');
try {
  execSync('npm run build', { stdio: 'inherit' });
  console.log('\nBuild completed successfully!');
  
  // Check if output exists
  if (existsSync('dist/index.js')) {
    console.log('✓ dist/index.js exists');
    
    // Try to start the server
    console.log('\nAttempting to start Brain server...');
    process.env.BRAIN_DATA_DIR = '/Users/bard/Code/brain/data';
    
    // Import and run
    import('./dist/index.js');
  } else {
    console.error('✗ dist/index.js not found after build');
  }
} catch (e) {
  console.error('Build failed:', e.message);
  process.exit(1);
}
