#!/bin/bash
# Clean and rebuild Brain

cd /Users/bard/Code/brain

echo "🧹 Cleaning dist directory..."
rm -rf dist

echo "🔨 Building Brain..."
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
else
    echo "❌ Build failed!"
    exit 1
fi
