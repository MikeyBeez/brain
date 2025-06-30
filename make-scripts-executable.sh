#!/bin/bash

# Make all the new scripts executable

cd /Users/bard/Code/brain

chmod +x setup-git-branch.sh
chmod +x build-and-test-execution.sh
chmod +x rollback-execution.sh

echo "✅ Scripts are now executable!"
echo ""
echo "To proceed:"
echo "1. Run: ./setup-git-branch.sh    # Set up git and create feature branch"
echo "2. Run: ./build-and-test-execution.sh    # Build and test the new code"
echo ""
echo "If something goes wrong:"
echo "- Run: ./rollback-execution.sh    # Restore original state"
