#!/bin/bash
# Build and start Brain server

cd /Users/bard/Code/brain

echo "🧠 Building Brain..."
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
    echo ""
    echo "🚀 Starting Brain MCP Server..."
    echo "Press Ctrl+C to stop"
    echo ""
    npm start
else
    echo "❌ Build failed. Please check the errors above."
    exit 1
fi
