#!/bin/bash
# Script to stop old Cortex and Nexus servers

echo "🛑 Stopping old Cortex and Nexus servers..."

# Kill any running Cortex processes
echo "Checking for Cortex processes..."
pkill -f "cortex.*mcp" 2>/dev/null
pkill -f "cortex.*server" 2>/dev/null
pkill -f "cortex_2" 2>/dev/null

# Kill any running Nexus processes
echo "Checking for Nexus processes..."
pkill -f "nexus.*mcp" 2>/dev/null
pkill -f "nexus.*server" 2>/dev/null
pkill -f "nexus_3" 2>/dev/null
pkill -f "localhost:8100" 2>/dev/null

# Check if any are still running
echo ""
echo "Checking for remaining processes..."
if pgrep -f "cortex|nexus" > /dev/null; then
    echo "⚠️  Some processes may still be running:"
    ps aux | grep -E "(cortex|nexus)" | grep -v grep
else
    echo "✅ All Cortex and Nexus processes stopped"
fi

echo ""
echo "📝 Configuration updated:"
echo "- Removed Cortex from Claude MCP servers"
echo "- Removed Nexus from Claude MCP servers"
echo "- Added Brain as replacement"
echo ""
echo "⚠️  Please restart Claude to apply the changes!"
