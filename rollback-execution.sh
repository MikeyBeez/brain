#!/bin/bash

# Rollback changes if something goes wrong

cd /Users/bard/Code/brain

echo "=== Rolling back execution module changes ==="
echo ""

# Restore original index.ts
if [ -f src/index.ts.old ]; then
    echo "Restoring original index.ts..."
    cp src/index.ts.old src/index.ts
fi

# Remove new files
echo "Removing new files..."
rm -f src/modules/execution/index.js
rm -f src/tools/execute.js
rm -f test-execution.js

# Rebuild
echo ""
echo "Rebuilding without execution module..."
npm run build

echo ""
echo "✅ Rollback complete!"
echo "The Brain server is back to its original state."
