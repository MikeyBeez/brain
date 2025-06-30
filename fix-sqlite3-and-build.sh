#!/bin/bash
cd /Users/bard/Code/brain

echo "🔧 Rebuilding better-sqlite3 for your Node.js version..."
npm rebuild better-sqlite3

if [ $? -eq 0 ]; then
    echo "✅ Rebuild successful!"
    echo ""
    echo "🧹 Cleaning and rebuilding the entire project..."
    npm run build
    
    if [ $? -eq 0 ]; then
        echo "✅ Build successful! Brain server is ready to start."
    else
        echo "❌ Build failed!"
        exit 1
    fi
else
    echo "❌ Failed to rebuild better-sqlite3"
    exit 1
fi
