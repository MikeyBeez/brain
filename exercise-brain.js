#!/usr/bin/env node
/**
 * Exercise Brain functionality to generate usage data
 */

// Add instrumentation first
import './analyzer/instrumentation.js';

// Now import Brain modules
import { memoryModule } from './dist/modules/memory/index.js';
import { sessionModule } from './dist/modules/sessions/index.js';
import { executionModule } from './dist/modules/execution/index.js';
import { notesModule } from './dist/modules/notes/index.js';
import { Database } from './dist/core/database.js';

console.log('🧪 Exercising Brain modules...\n');

async function exerciseBrain() {
  try {
    // Initialize database
    console.log('1. Initializing database...');
    const db = new Database();
    await db.initialize();
    
    // Exercise memory module
    console.log('2. Testing memory module...');
    memoryModule.initialize(db);
    
    // Store some memories
    await memoryModule.remember('test_key_1', { data: 'test value 1' }, 'test');
    await memoryModule.remember('test_key_2', { data: 'test value 2' }, 'test');
    
    // Recall memories
    const recalled = await memoryModule.recall('test', 5);
    console.log(`   Recalled ${recalled.length} memories`);
    
    // Exercise session module
    console.log('3. Testing session module...');
    sessionModule.initialize(db);
    
    const session = await sessionModule.create();
    console.log(`   Created session: ${session.id}`);
    
    // Exercise execution module
    console.log('4. Testing execution module...');
    executionModule.initialize();
    
    // Exercise notes module
    console.log('5. Testing notes module...');
    notesModule.initialize(db);
    
    // Create a note
    const note = await notesModule.create('Test Note', 'This is test content');
    console.log(`   Created note: ${note.title}`);
    
    // List notes
    const notes = await notesModule.list(5);
    console.log(`   Found ${notes.length} notes`);
    
    console.log('\n✅ All modules exercised successfully!');
    
    // Cleanup
    await db.close();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run the exercise
exerciseBrain().then(() => {
  console.log('\n📊 Check the analyzer now for comprehensive usage data!');
  process.exit(0);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
