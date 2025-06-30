#!/usr/bin/env node

/**
 * Brain Log Manager
 * 
 * Manages log rotation and cleanup for Brain MCP server
 */

import { existsSync, readdirSync, statSync, unlinkSync } from 'fs';
import { join } from 'path';

const logsDir = '/Users/bard/Code/brain/logs';
const dataDir = '/Users/bard/Code/brain/data';

// Configuration
const config = {
  maxLogSize: 10 * 1024 * 1024, // 10MB
  maxLogAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  maxBuildLogs: 5,
  maxBrainLogs: 10
};

function cleanupLogs() {
  if (!existsSync(logsDir)) return;
  
  const now = Date.now();
  const files = readdirSync(logsDir);
  
  // Group files by type
  const buildLogs = files.filter(f => f.startsWith('build.log')).sort();
  const brainLogs = files.filter(f => f.startsWith('brain.log')).sort();
  
  // Clean old or large files
  files.forEach(file => {
    const filePath = join(logsDir, file);
    try {
      const stats = statSync(filePath);
      
      // Remove if too old or too large
      if (now - stats.mtime.getTime() > config.maxLogAge || 
          stats.size > config.maxLogSize) {
        unlinkSync(filePath);
        console.log(`Removed old/large log: ${file}`);
      }
    } catch (err) {
      // Ignore errors
    }
  });
  
  // Keep only recent build logs
  if (buildLogs.length > config.maxBuildLogs) {
    buildLogs.slice(0, -config.maxBuildLogs).forEach(file => {
      try {
        unlinkSync(join(logsDir, file));
        console.log(`Removed old build log: ${file}`);
      } catch (err) {
        // Ignore
      }
    });
  }
}

// Also clean up brain.log in data directory if it gets too large
function cleanupBrainLog() {
  const brainLog = join(dataDir, 'brain.log');
  if (existsSync(brainLog)) {
    try {
      const stats = statSync(brainLog);
      if (stats.size > config.maxLogSize) {
        // Rotate instead of delete
        const backupPath = join(dataDir, `brain.log.${Date.now()}`);
        renameSync(brainLog, backupPath);
        console.log('Rotated brain.log');
        
        // Clean old backups
        const files = readdirSync(dataDir);
        const backups = files.filter(f => f.startsWith('brain.log.')).sort();
        if (backups.length > 3) {
          backups.slice(0, -3).forEach(file => {
            unlinkSync(join(dataDir, file));
          });
        }
      }
    } catch (err) {
      console.error('Error managing brain.log:', err.message);
    }
  }
}

// Run cleanup
console.log('Running log cleanup...');
cleanupLogs();
cleanupBrainLog();
console.log('Log cleanup complete');
