#!/bin/bash
# Start Brain Execution API for Monitex

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PLIST_PATH="$SCRIPT_DIR/launchd/com.brain.execution-api.plist"
AGENT_DIR="$HOME/Library/LaunchAgents"

echo "🧠 Starting Brain Execution API"
echo "================================"

# Create logs directory if it doesn't exist
mkdir -p "$SCRIPT_DIR/logs/execution"

# Copy plist to LaunchAgents if not already there
if [ ! -f "$AGENT_DIR/com.brain.execution-api.plist" ]; then
    echo "📋 Installing launch agent..."
    cp "$PLIST_PATH" "$AGENT_DIR/"
fi

# Unload if already loaded (ignore errors)
launchctl unload "$AGENT_DIR/com.brain.execution-api.plist" 2>/dev/null

# Load the service
echo "🔧 Loading Brain Execution API service..."
if launchctl load "$AGENT_DIR/com.brain.execution-api.plist"; then
    echo "✅ Brain Execution API started successfully"
    echo ""
    echo "📊 API available at: http://localhost:9998"
    echo ""
    echo "To view logs:"
    echo "  tail -f $SCRIPT_DIR/logs/api.log"
    echo ""
    echo "To stop the API:"
    echo "  launchctl unload ~/Library/LaunchAgents/com.brain.execution-api.plist"
else
    echo "❌ Failed to start Brain Execution API"
    exit 1
fi
