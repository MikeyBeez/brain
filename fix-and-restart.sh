#!/bin/bash

# Fix and restart Brain server
echo "Fixing and restarting Brain server..."

# Clean up old build
echo "Cleaning old build..."
rm -rf dist/

# Rebuild the project
echo "Building project..."
npm run build

# Check if build was successful
if [ $? -ne 0 ]; then
    echo "Build failed! Check the errors above."
    exit 1
fi

echo "Build successful! The Brain server should now start correctly."
echo "The launcher will handle starting the server when Claude connects."
