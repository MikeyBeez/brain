#!/bin/bash
cd /Users/bard/Code/brain

echo "🔨 Rebuilding Brain with fixed tool names..."
npm run build

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Build successful!"
    echo ""
    echo "The Brain server tools have been renamed to use underscores instead of colons:"
    echo "  - brain:init → brain_init"
    echo "  - brain:remember → brain_remember"
    echo "  - brain:recall → brain_recall"
    echo "  - brain:status → brain_status"
    echo ""
    echo "Please restart the Brain server in Claude for the changes to take effect."
else
    echo "❌ Build failed!"
    exit 1
fi
