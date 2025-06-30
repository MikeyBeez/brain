#!/bin/bash
# Brain MCP Launcher Script with debugging

# Set the working directory
cd /Users/bard/Code/brain

# Log startup
echo "Starting Brain from: $(pwd)" >> launch.log
echo "Date: $(date)" >> launch.log

# Create data directory if it doesn't exist
if [ ! -d "data" ]; then
    echo "Creating data directory..." >> launch.log
    mkdir -p data
fi

# Check if dist/index.js exists
if [ ! -f "dist/index.js" ]; then
    echo "ERROR: dist/index.js not found!" >> launch.log
    echo "Running build..." >> launch.log
    npm run build >> launch.log 2>&1
fi

# Set environment
export BRAIN_DATA_DIR="/Users/bard/Code/brain/data"

# Run the Brain server
echo "Launching Brain server..." >> launch.log
exec node dist/index.js 2>> launch.log
