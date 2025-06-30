#!/bin/bash

# Initialize git and create a branch for the execution module feature

cd /Users/bard/Code/brain

echo "=== Setting up Git ==="

# Check if git is initialized
if [ ! -d .git ]; then
    echo "Initializing git repository..."
    git init
    
    # Add all files to initial commit
    git add .
    git commit -m "Initial commit - Brain MCP Server"
else
    echo "Git already initialized"
fi

echo ""
echo "=== Current Status ==="
git status

echo ""
echo "=== Creating feature branch ==="
# Create and checkout feature branch
git checkout -b feature/execution-module

echo ""
echo "=== Adding new files ==="
# Add the new files we created
git add src/modules/execution/index.js
git add src/tools/execute.js
git add src/index.ts
git add test-execution.js

echo ""
echo "=== Committing changes ==="
git commit -m "Add execution module with Python REPL integration

- Created execution module with persistent Python process
- Added brain_execute MCP tool
- Integrated Brain database access in Python context
- Full system access with transparent logging
- Updated index.ts to register new module and tool"

echo ""
echo "=== Done! ==="
echo "You are now on branch: $(git branch --show-current)"
echo "To switch back to main: git checkout main"
echo "To merge when ready: git checkout main && git merge feature/execution-module"
