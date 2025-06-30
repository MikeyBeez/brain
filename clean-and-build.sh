#!/bin/bash

# Clean build script for Brain MCP server
cd /Users/bard/Code/brain

echo "Cleaning build directory..."
rm -rf dist/*

echo "Running TypeScript build..."
npm run build

if [ $? -eq 0 ]; then
    echo "Build completed successfully!"
else
    echo "Build failed!"
    exit 1
fi
