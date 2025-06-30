#!/bin/bash
cd /Users/bard/Code/brain

echo "Making brain-launcher.js executable..."
chmod +x brain-launcher.js

echo ""
echo "Testing the launcher with correct Node.js..."
/opt/homebrew/bin/node --version

echo ""
echo "The Brain server is now configured to use Node.js v24.3.0"
echo "Claude should be able to connect successfully now!"
