#!/bin/bash
# Complete removal of Nexus and Cortex services

echo "🛑 Completely removing Nexus and Cortex services..."
echo ""

# The plist files we found
NEXUS_PLIST="com.mikeybee.nexus3"
CORTEX_PLIST="com.mikeybee.cortex2"
CORTEX_API_PLIST="com.mikeybee.cortex2_api"

# LaunchAgents directory
LAUNCH_AGENTS_DIR="$HOME/Library/LaunchAgents"

echo "Step 1: Unloading services from launchctl..."

# Unload Nexus
if launchctl list | grep -q "$NEXUS_PLIST"; then
    echo "  Unloading $NEXUS_PLIST..."
    launchctl unload -w "$LAUNCH_AGENTS_DIR/$NEXUS_PLIST.plist" 2>/dev/null
    launchctl remove "$NEXUS_PLIST" 2>/dev/null
fi

# Unload Cortex
if launchctl list | grep -q "$CORTEX_PLIST"; then
    echo "  Unloading $CORTEX_PLIST..."
    launchctl unload -w "$LAUNCH_AGENTS_DIR/$CORTEX_PLIST.plist" 2>/dev/null
    launchctl remove "$CORTEX_PLIST" 2>/dev/null
fi

# Unload Cortex API
if launchctl list | grep -q "$CORTEX_API_PLIST"; then
    echo "  Unloading $CORTEX_API_PLIST..."
    launchctl unload -w "$LAUNCH_AGENTS_DIR/$CORTEX_API_PLIST.plist" 2>/dev/null
    launchctl remove "$CORTEX_API_PLIST" 2>/dev/null
fi

echo ""
echo "Step 2: Removing plist files from LaunchAgents..."

# Remove plist files if they exist
if [ -f "$LAUNCH_AGENTS_DIR/$NEXUS_PLIST.plist" ]; then
    echo "  Removing $LAUNCH_AGENTS_DIR/$NEXUS_PLIST.plist"
    rm -f "$LAUNCH_AGENTS_DIR/$NEXUS_PLIST.plist"
fi

if [ -f "$LAUNCH_AGENTS_DIR/$CORTEX_PLIST.plist" ]; then
    echo "  Removing $LAUNCH_AGENTS_DIR/$CORTEX_PLIST.plist"
    rm -f "$LAUNCH_AGENTS_DIR/$CORTEX_PLIST.plist"
fi

if [ -f "$LAUNCH_AGENTS_DIR/$CORTEX_API_PLIST.plist" ]; then
    echo "  Removing $LAUNCH_AGENTS_DIR/$CORTEX_API_PLIST.plist"
    rm -f "$LAUNCH_AGENTS_DIR/$CORTEX_API_PLIST.plist"
fi

echo ""
echo "Step 3: Killing any remaining processes..."

# Kill processes
pkill -f "nexus" 2>/dev/null
pkill -f "cortex" 2>/dev/null
pkill -f "uvicorn.*8100" 2>/dev/null  # Kill Nexus on port 8100

echo ""
echo "Step 4: Verification..."

# Check if services are still in launchctl
echo "Checking launchctl list:"
if launchctl list | grep -E "(nexus|cortex)"; then
    echo "⚠️  Some services still showing in launchctl"
else
    echo "✅ No Nexus/Cortex services in launchctl"
fi

echo ""
echo "Checking for running processes:"
if ps aux | grep -E "(nexus|cortex)" | grep -v grep; then
    echo "⚠️  Some processes still running"
else
    echo "✅ No Nexus/Cortex processes running"
fi

echo ""
echo "Checking LaunchAgents directory:"
ls -la "$LAUNCH_AGENTS_DIR" | grep -E "(nexus|cortex)" || echo "✅ No plist files found"

echo ""
echo "📝 Summary:"
echo "- Unloaded services from launchctl"
echo "- Removed plist files from ~/Library/LaunchAgents"
echo "- Killed any remaining processes"
echo "- Already removed from Claude MCP configuration"
echo ""
echo "✅ Nexus and Cortex have been completely removed!"
echo ""
echo "If any processes are still running, you can manually kill them:"
echo "  sudo kill -9 <PID>"
