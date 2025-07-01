/**
 * Code Usage Instrumentation
 * 
 * Minimal hooks to track code usage without modifying source files.
 * Add this as the first require in your main entry points.
 */

import Module from 'module';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ANALYZER_HOST = 'localhost';
const ANALYZER_PORT = 9997;
const PROJECT_ROOT = path.join(__dirname, '..');

// Queue for traces to send
const traceQueue = [];
let sending = false;

// Send trace to analyzer
function sendTrace(trace) {
  traceQueue.push(trace);
  
  if (!sending) {
    sending = true;
    process.nextTick(flushTraces);
  }
}

// Batch send traces
function flushTraces() {
  if (traceQueue.length === 0) {
    sending = false;
    return;
  }
  
  const traces = traceQueue.splice(0, 10); // Send up to 10 at a time
  
  traces.forEach(trace => {
    const data = JSON.stringify(trace);
    const req = http.request({
      hostname: ANALYZER_HOST,
      port: ANALYZER_PORT,
      path: '/trace',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    });
    
    req.on('error', () => {
      // Silently ignore errors to not disrupt the app
    });
    
    req.write(data);
    req.end();
  });
  
  // Continue flushing if more traces
  if (traceQueue.length > 0) {
    setImmediate(flushTraces);
  } else {
    sending = false;
  }
}

// Store original require
const originalRequire = Module.prototype.require;

// Override require to track file usage
Module.prototype.require = function(id) {
  const result = originalRequire.apply(this, arguments);
  
  try {
    // Get the resolved filename
    const filename = Module._resolveFilename(id, this);
    
    if (typeof filename === 'string' && !filename.includes('node_modules')) {
      const relPath = path.relative(PROJECT_ROOT, filename);
      
      sendTrace({
        type: 'require',
        file: relPath,
        module: id.startsWith('.') ? null : id
      });
      
      // Wrap exports if it's an object
      if (typeof result === 'object' && result !== null) {
        return wrapExports(result, relPath);
      }
    }
  } catch (err) {
    // Ignore errors in instrumentation
  }
  
  return result;
};

// Wrap exported functions to track calls
function wrapExports(exports, filename) {
  const wrapped = {};
  
  for (const key in exports) {
    const value = exports[key];
    
    if (typeof value === 'function') {
      wrapped[key] = function(...args) {
        sendTrace({
          type: 'function',
          file: filename,
          function: key
        });
        return value.apply(this, args);
      };
      // Preserve function properties
      Object.setPrototypeOf(wrapped[key], value);
      Object.assign(wrapped[key], value);
    } else {
      wrapped[key] = value;
    }
  }
  
  // Preserve prototype chain
  Object.setPrototypeOf(wrapped, exports);
  
  return wrapped;
}

// Track uncaught exceptions
process.on('uncaughtException', (err) => {
  sendTrace({
    type: 'error',
    error: err.message,
    stack: err.stack
  });
  // Re-throw to maintain normal behavior
  throw err;
});

console.log('Code usage instrumentation active');

export { sendTrace, flushTraces };
