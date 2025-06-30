/**
 * Test the execution module
 */

import { executionModule } from './src/modules/execution/index.js';

async function test() {
  console.log('Initializing execution module...');
  executionModule.initialize();
  
  // Wait for it to be ready
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  console.log('Testing Python execution...');
  
  try {
    // Test 1: Simple execution
    const result1 = await executionModule.execute('print("Hello from Python!")', {
      description: 'Basic test'
    });
    console.log('Test 1 result:', result1);
    
    // Test 2: List /usr/bin
    const result2 = await executionModule.execute(`
import os
files = os.listdir('/usr/bin')
print(f"Found {len(files)} files in /usr/bin")
print("First 10 files:", files[:10])
`, {
      description: 'List /usr/bin directory'
    });
    console.log('Test 2 result:', result2);
    
    // Test 3: System info
    const result3 = await executionModule.execute(`
import platform
print(f"Python version: {platform.python_version()}")
print(f"System: {platform.system()} {platform.release()}")
`, {
      description: 'Get system info'
    });
    console.log('Test 3 result:', result3);
    
  } catch (error) {
    console.error('Test failed:', error);
  }
  
  console.log('Tests complete!');
  process.exit(0);
}

test();
