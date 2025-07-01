#!/usr/bin/env node

/**
 * Test Shell Execution Feature
 * 
 * Demonstrates the new auto-detection and shell execution capabilities
 */

import { executionModule } from './dist/modules/execution/index.js';

async function testShellExecution() {
  console.log('🧪 Testing Shell Execution Feature\n');
  
  // Initialize module
  executionModule.initialize();
  
  // Test cases
  const tests = [
    {
      name: 'Single shell command',
      code: 'ls -la',
      expectedLang: 'shell'
    },
    {
      name: 'Shell with pipes',
      code: 'echo "Hello World" | wc -w',
      expectedLang: 'shell'
    },
    {
      name: 'Python print',
      code: 'print("Hello from Python")',
      expectedLang: 'python'
    },
    {
      name: 'Multi-line Python',
      code: `
import os
print(f"Current directory: {os.getcwd()}")
print("Python execution works!")
`,
      expectedLang: 'python'
    },
    {
      name: 'Shell file operations',
      code: 'touch test.txt && echo "content" > test.txt && cat test.txt && rm test.txt',
      expectedLang: 'shell'
    },
    {
      name: 'Explicit language override',
      code: 'echo "Forcing shell"',
      language: 'shell',
      expectedLang: 'shell'
    }
  ];
  
  // Run tests
  for (const test of tests) {
    console.log(`\n📋 Test: ${test.name}`);
    console.log(`   Code: ${test.code.trim()}`);
    
    try {
      const result = await executionModule.execute(test.code, {
        description: test.name,
        language: test.language || 'auto'
      });
      
      console.log(`   ✅ Detected: ${result.language}`);
      console.log(`   📤 Output: ${result.stdout || '(no output)'}`);
      if (result.stderr) {
        console.log(`   ⚠️ Stderr: ${result.stderr}`);
      }
      console.log(`   ⏱️ Time: ${result.executionTime}`);
      
      if (result.language !== test.expectedLang) {
        console.log(`   ❌ Expected ${test.expectedLang} but got ${result.language}`);
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
  }
  
  // Cleanup
  console.log('\n✨ Tests complete!');
  executionModule.shutdown();
  process.exit(0);
}

// Run tests
testShellExecution().catch(console.error);
