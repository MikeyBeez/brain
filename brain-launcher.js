#!/Users/bard/Code/brain/node-wrapper.sh

/**
 * Brain MCP Server Launcher with Output Redirection
 * 
 * Captures build output to a file and only shows errors on stderr
 */

import { spawn } from 'child_process';
import { existsSync, mkdirSync, unlinkSync, writeFileSync, renameSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = __dirname;
const require = createRequire(import.meta.url);

// Log Node.js version for debugging
console.error(`Brain: Starting with Node.js ${process.version} (module version ${process.versions.modules})`);

// Change to project directory
process.chdir(projectRoot);

// Ensure directories exist
const dataDir = process.env.BRAIN_DATA_DIR || join(projectRoot, 'data');
const logsDir = join(projectRoot, 'logs');

if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}
if (!existsSync(logsDir)) {
  mkdirSync(logsDir, { recursive: true });
}

// Main entry point
async function main() {
  // Check if better-sqlite3 needs rebuilding
  const sqlite3Path = join(projectRoot, 'node_modules/better-sqlite3/build/Release/better_sqlite3.node');
  let needsRebuild = false;
  
  if (existsSync(sqlite3Path)) {
    try {
      // Try to load the module to see if it's compatible
      require(join(projectRoot, 'node_modules/better-sqlite3'));
    } catch (error) {
      if (error.message && error.message.includes('NODE_MODULE_VERSION')) {
        needsRebuild = true;
      }
    }
  } else {
    needsRebuild = true;
  }
  
  if (needsRebuild) {
    console.error('Brain: better-sqlite3 needs rebuilding for Node.js', process.version);
    
    await new Promise((resolve, reject) => {
      const rebuildProcess = spawn('npm', ['rebuild', 'better-sqlite3'], {
        cwd: projectRoot,
        shell: true,
        stdio: ['ignore', 'pipe', 'pipe']
      });
      
      let output = '';
      rebuildProcess.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      rebuildProcess.stderr.on('data', (data) => {
        output += data.toString();
      });
      
      rebuildProcess.on('close', (code) => {
        if (code !== 0) {
          console.error('Brain: Failed to rebuild better-sqlite3');
          console.error(output);
          reject(new Error('Rebuild failed'));
        } else {
          console.error('Brain: Rebuild complete');
          resolve();
        }
      });
    });
  }
  
  continueStartup();
}

// Start the main function
main().catch(error => {
  console.error('Brain: Fatal error:', error.message);
  process.exit(1);
});

function continueStartup() {
  // Log rotation - keep last 5 logs
  const buildLog = join(logsDir, 'build.log');
  const maxLogs = 5;

  // Rotate existing logs
  for (let i = maxLogs - 1; i >= 1; i--) {
    const oldLog = join(logsDir, `build.log.${i}`);
    const newLog = join(logsDir, `build.log.${i + 1}`);
    if (existsSync(oldLog)) {
      if (i === maxLogs - 1 && existsSync(newLog)) {
        unlinkSync(newLog); // Remove oldest
      }
      renameSync(oldLog, newLog);
    }
  }

  // Move current log to .1
  if (existsSync(buildLog)) {
    const stats = statSync(buildLog);
    // Only rotate if file is larger than 1MB or older than 7 days
    if (stats.size > 1024 * 1024 || Date.now() - stats.mtime.getTime() > 7 * 24 * 60 * 60 * 1000) {
      renameSync(buildLog, join(logsDir, 'build.log.1'));
    } else {
      // Just truncate if recent and small
      writeFileSync(buildLog, `--- Build log truncated at ${new Date().toISOString()} ---\n`);
    }
  }

  // Check if we need to build
  const distPath = join(projectRoot, 'dist', 'index.js');
  if (!existsSync(distPath)) {
    console.error('Brain: Building project...');
    
    // Run build with output to file
    const buildProcess = spawn('npm', ['run', 'build'], {
      cwd: projectRoot,
      shell: true
    });
    
    let buildOutput = '';
    buildProcess.stdout.on('data', (data) => {
      buildOutput += data.toString();
    });
    
    buildProcess.stderr.on('data', (data) => {
      buildOutput += data.toString();
    });
    
    buildProcess.on('close', (code) => {
      // Save build output
      writeFileSync(buildLog, buildOutput);
      
      if (code !== 0) {
        console.error('Brain: Build failed! Check logs/build.log for details');
        process.exit(1);
      }
      
      // Build successful, start the server
      startServer();
    });
  } else {
    // Already built, start directly
    startServer();
  }
}

function startServer() {
  try {
    // Import and run the server
    import('./dist/index.js').catch(error => {
      console.error('Brain: Failed to start server:', error.message);
      process.exit(1);
    });
  } catch (error) {
    console.error('Brain: Startup error:', error.message);
    process.exit(1);
  }
}
