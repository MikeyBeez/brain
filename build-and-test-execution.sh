#!/bin/bash

# Build and test the execution module

cd /Users/bard/Code/brain

echo "=== Building Brain with Execution Module ==="
echo ""

# Build the TypeScript
echo "Running npm build..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

echo "✅ Build successful!"
echo ""

echo "=== Testing Execution Module ==="
echo ""

# Run the test
echo "Running execution module test..."
node test-execution.js

echo ""
echo "=== Build Summary ==="
echo "- TypeScript compiled successfully"
echo "- New files created:"
echo "  - src/modules/execution/index.js"
echo "  - src/tools/execute.js"
echo "  - Updated src/index.ts"
echo ""
echo "To start using brain_execute in Claude:"
echo "1. Restart the Brain MCP server in Claude settings"
echo "2. Use: brain_execute({ code: 'print(\"Hello!\")', description: 'Test' })"
