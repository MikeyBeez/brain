#!/usr/bin/env node
/**
 * Example: How to add usage tracking to Brain
 * 
 * Add the instrumentation require at the very top of your entry files
 */

// IMPORTANT: This must be the FIRST require
require('./instrumentation');

// Now load and run your app normally
// For example:
// require('../brain-mcp');
// require('../src/index');

console.log('Usage tracking example');
console.log('Add require("./analyzer/instrumentation") to the top of:');
console.log('  - brain-mcp.js');
console.log('  - brain-simple.js'); 
console.log('  - start-mcp.js');
console.log('  - Any other entry points');
