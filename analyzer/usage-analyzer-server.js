#!/usr/bin/env node
/**
 * Code Usage Analyzer Server
 * 
 * Tracks which parts of the Brain codebase are actually used.
 * Runs on port 9997 (below execution API and monitor).
 * 
 * Design goals:
 * - Minimal performance impact
 * - Track file requires, function calls, and dependencies
 * - Identify dead code in 10,000+ file project
 */

import http from 'http';
import { promises as fs } from 'fs';
import path from 'path';
import { URL } from 'url';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 9997;
const DATA_FILE = path.join(__dirname, 'usage-data.json');

// In-memory usage data
let usageData = {
  startTime: new Date().toISOString(),
  files: {},      // file path -> { required: count, exports: {} }
  modules: {},    // module name -> count
  uncaughtFiles: new Set(), // Files that exist but were never required
  errors: []
};

// Load existing data if available
async function loadData() {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf8');
    usageData = JSON.parse(data);
    usageData.uncaughtFiles = new Set(usageData.uncaughtFiles);
    console.log('Loaded existing usage data');
  } catch (err) {
    console.log('Starting fresh usage tracking');
  }
}

// Save data periodically
async function saveData() {
  const dataToSave = {
    ...usageData,
    uncaughtFiles: Array.from(usageData.uncaughtFiles)
  };
  await fs.writeFile(DATA_FILE, JSON.stringify(dataToSave, null, 2));
}

// HTTP server for receiving traces and serving reports
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'POST' && url.pathname === '/trace') {
    // Receive usage trace
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const trace = JSON.parse(body);
        recordTrace(trace);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'recorded' }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  }
  
  else if (req.method === 'GET' && url.pathname === '/report') {
    // Generate usage report
    const report = generateReport();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(report, null, 2));
  }
  
  else if (req.method === 'GET' && url.pathname === '/unused') {
    // Find potentially unused code
    const unused = await findUnusedCode();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(unused, null, 2));
  }
  
  else if (req.method === 'GET' && url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'healthy',
      uptime: process.uptime(),
      trackedFiles: Object.keys(usageData.files).length
    }));
  }
  
  else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      error: 'Not found',
      endpoints: [
        'POST /trace - Record usage trace',
        'GET /report - Get usage report', 
        'GET /unused - Find unused code',
        'GET /health - Server health'
      ]
    }));
  }
});

// Record a usage trace
function recordTrace(trace) {
  const { type, file, module, function: func, count = 1 } = trace;
  
  if (type === 'require') {
    // Track file requires
    if (!usageData.files[file]) {
      usageData.files[file] = { required: 0, exports: {} };
    }
    usageData.files[file].required += count;
    
    // Track module requires
    if (module) {
      usageData.modules[module] = (usageData.modules[module] || 0) + count;
    }
  }
  
  else if (type === 'function' && file && func) {
    // Track function calls
    if (!usageData.files[file]) {
      usageData.files[file] = { required: 0, exports: {} };
    }
    if (!usageData.files[file].exports[func]) {
      usageData.files[file].exports[func] = 0;
    }
    usageData.files[file].exports[func] += count;
  }
  
  else if (type === 'error') {
    usageData.errors.push({
      ...trace,
      timestamp: new Date().toISOString()
    });
  }
}

// Generate usage report
function generateReport() {
  const totalFiles = Object.keys(usageData.files).length;
  const usedFiles = Object.values(usageData.files).filter(f => f.required > 0).length;
  
  // Find hot files (required often)
  const hotFiles = Object.entries(usageData.files)
    .filter(([_, data]) => data.required > 10)
    .sort((a, b) => b[1].required - a[1].required)
    .slice(0, 20)
    .map(([file, data]) => ({ file, required: data.required }));
  
  // Find cold files (required rarely)
  const coldFiles = Object.entries(usageData.files)
    .filter(([_, data]) => data.required > 0 && data.required <= 2)
    .length;
  
  // Find most used functions
  const functionCalls = [];
  for (const [file, data] of Object.entries(usageData.files)) {
    for (const [func, count] of Object.entries(data.exports)) {
      functionCalls.push({ file, function: func, calls: count });
    }
  }
  functionCalls.sort((a, b) => b.calls - a.calls);
  
  return {
    summary: {
      startTime: usageData.startTime,
      totalFilesTracked: totalFiles,
      filesActuallyUsed: usedFiles,
      percentageUsed: ((usedFiles / totalFiles) * 100).toFixed(1) + '%',
      coldFiles,
      errors: usageData.errors.length
    },
    hotFiles: hotFiles.slice(0, 10),
    topFunctions: functionCalls.slice(0, 10),
    topModules: Object.entries(usageData.modules)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([module, count]) => ({ module, count }))
  };
}

// Find unused code
async function findUnusedCode() {
  const projectRoot = path.join(__dirname, '..');
  const allFiles = new Set();
  const usedFiles = new Set(Object.keys(usageData.files));
  
  // Scan project for all JS/TS files
  async function scanDir(dir) {
    if (dir.includes('node_modules') || dir.includes('.git')) return;
    
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          await scanDir(fullPath);
        } else if (entry.isFile() && /\.(js|ts|mjs)$/.test(entry.name)) {
          const relPath = path.relative(projectRoot, fullPath);
          allFiles.add(relPath);
        }
      }
    } catch (err) {
      // Ignore permission errors
    }
  }
  
  await scanDir(projectRoot);
  
  // Find files that were never required
  const unusedFiles = Array.from(allFiles).filter(file => !usedFiles.has(file));
  
  // Find functions that were never called
  const unusedFunctions = [];
  for (const [file, data] of Object.entries(usageData.files)) {
    if (data.required > 0) {
      // File was required, check for unused exports
      const funcs = Object.keys(data.exports);
      if (funcs.length === 0 && data.required > 5) {
        // File was required but no functions were tracked as called
        unusedFunctions.push({
          file,
          message: 'File required but no exports used',
          requiredCount: data.required
        });
      }
    }
  }
  
  return {
    summary: {
      totalFiles: allFiles.size,
      unusedFiles: unusedFiles.length,
      percentageUnused: ((unusedFiles.length / allFiles.size) * 100).toFixed(1) + '%',
      potentialSavings: `~${(unusedFiles.length * 10 / 1024).toFixed(1)}MB (estimate)`
    },
    unusedFiles: unusedFiles.slice(0, 100), // First 100
    suspiciousFunctions: unusedFunctions.slice(0, 20),
    recommendation: unusedFiles.length > allFiles.size * 0.3 
      ? 'Significant dead code detected. Consider cleanup.'
      : 'Code usage looks reasonable.'
  };
}

// Save data every 30 seconds
setInterval(saveData, 30000);

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nSaving usage data...');
  await saveData();
  process.exit(0);
});

// Start server
loadData().then(() => {
  server.listen(PORT, () => {
    console.log(`Code Usage Analyzer running on port ${PORT}`);
    console.log('Endpoints:');
    console.log('  POST /trace - Record usage');
    console.log('  GET /report - Usage statistics');
    console.log('  GET /unused - Find dead code');
    console.log('  GET /health - Server status');
  });
});
