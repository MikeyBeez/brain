# Brain Code Usage Analyzer

Tracks which code is actually used in the Brain project (10,000+ files).

## Problem
- Brain project has 10,000+ files
- Most code is probably unused
- Need to identify what can be safely deleted

## Solution
- Minimal instrumentation hooks into Node.js require()
- Tracks file requires and function calls
- Identifies dead code without modifying source files

## Quick Start

1. Start the analyzer server:
   ```bash
   node analyzer/usage-analyzer-server.js
   ```

2. Add instrumentation to your entry files:
   ```javascript
   // At the VERY TOP of brain-mcp.js, brain-simple.js, etc:
   require('./analyzer/instrumentation');
   
   // Then your normal code...
   ```

3. Use Brain normally for a day to collect usage data

4. View results:
   - Open Monitex at http://localhost:9999
   - Click on the "Brain" tab
   - Click on "Code Usage Analyzer" sub-tab
   - Or use API endpoints directly:
     - `GET http://localhost:9997/report` - Usage statistics
     - `GET http://localhost:9997/unused` - Find dead code

## How It Works

1. **Instrumentation**: Wraps Node's require() to track file loads
2. **Function Tracking**: Wraps exported functions to count calls  
3. **Analyzer Server**: Collects traces on port 9997
4. **Zero Source Changes**: No need to modify existing code

## What It Tracks

- Which files are required
- How often each file is required
- Which exported functions are called
- Module dependencies
- Hot paths (frequently used code)
- Cold paths (rarely used code)

## Expected Results

With 10,000 files, we expect to find:
- 50-80% of files are never required
- Many files are required but exports never used
- Clear hot paths to optimize
- Clear dead code to remove

## Next Steps

After collecting data:
1. Review unused files carefully
2. Check for dynamic requires that might be missed
3. Delete dead code in phases
4. Re-test after each deletion phase

## Tips

- Let it run for at least a full day
- Exercise all features of Brain during collection
- The analyzer has minimal performance impact
- Data is saved to `analyzer/usage-data.json`
- Send HUP signal to analyzer for graceful reload

## Architecture

```
Port 9999: Monitex (execution monitor)
Port 9998: Execution API 
Port 9997: Usage Analyzer (this tool)
```
