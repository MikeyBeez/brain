#!/bin/bash

echo "Rebuilding brain project for Claude's Node.js version..."

cd /Users/bard/Code/brain

# Clean everything
echo "Cleaning build artifacts..."
rm -rf node_modules/better-sqlite3/build
rm -rf node_modules/better-sqlite3/prebuilds
rm -rf dist

# Ensure we're using the correct Node version
echo "Current Node version:"
node --version

# Rebuild better-sqlite3 specifically
echo "Rebuilding better-sqlite3..."
cd node_modules/better-sqlite3
node-gyp rebuild --release
cd ../..

# Build the TypeScript
echo "Building TypeScript..."
npm run build

echo "Rebuild complete!"
