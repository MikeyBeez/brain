#!/bin/bash
cd /Users/bard/Code/brain

echo "🧹 Removing dist directory completely..."
rm -rf dist/

echo "🔨 Running TypeScript build..."
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
    echo "The Brain server is now ready to start."
else
    echo "❌ Build failed!"
    exit 1
fi
