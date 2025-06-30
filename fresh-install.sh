#!/bin/bash
cd /Users/bard/Code/brain

echo "🔍 Checking Node.js version..."
node --version

echo ""
echo "🧹 Cleaning up old builds and node_modules..."
rm -rf node_modules package-lock.json dist

echo ""
echo "📦 Installing fresh dependencies..."
npm install

echo ""
echo "🔨 Building the project..."
npm run build

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Everything is ready! Brain server should now work with your Node.js version."
else
    echo "❌ Build failed!"
    exit 1
fi
