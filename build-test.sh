#!/bin/bash
cd /Users/bard/Code/brain
echo "Starting build..."
npm run build 2>&1
echo "Build complete, exit code: $?"
