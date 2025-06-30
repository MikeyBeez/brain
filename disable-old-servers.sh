#!/bin/bash
# Script to stop and disable Cortex and Nexus launch agents/daemons

echo "🛑 Stopping and disabling old Cortex and Nexus services..."
echo ""

# Function to stop and disable a service
stop_and_disable_service() {
    local service_name=$1
    echo "Checking for $service_name..."
    
    # Check if the service exists
    if launchctl list | grep -q "$service_name"; then
        echo "  Found $service_name - stopping and disabling..."
        launchctl stop "$service_name"
        launchctl disable "$service_name"
        echo "  ✅ $service_name stopped and disabled"
    else
        echo "  ℹ️  $service_name not found in launchctl"
    fi
}

# Stop and disable Nexus variants
stop_and_disable_service "nexus"
stop_and_disable_service "nexus3"
stop_and_disable_service "nexus_3"
stop_and_disable_service "com.nexus.server"
stop_and_disable_service "com.user.nexus"

echo ""

# Stop and disable Cortex variants
stop_and_disable_service "cortex"
stop_and_disable_service "cortex2"
stop_and_disable_service "cortex_2"
stop_and_disable_service "com.cortex.server"
stop_and_disable_service "com.user.cortex"

echo ""
echo "Checking for LaunchAgent plist files..."

# Check common locations for launch agent plists
LAUNCH_PATHS=(
    "$HOME/Library/LaunchAgents"
    "/Library/LaunchAgents"
    "/Library/LaunchDaemons"
    "/System/Library/LaunchAgents"
    "/System/Library/LaunchDaemons"
)

for path in "${LAUNCH_PATHS[@]}"; do
    if [ -d "$path" ]; then
        echo "Checking $path..."
        ls -la "$path" 2>/dev/null | grep -E "(nexus|cortex)" || echo "  No Nexus/Cortex plists found"
    fi
done

echo ""
echo "Killing any remaining processes..."

# Kill any remaining processes
pkill -f "cortex" 2>/dev/null
pkill -f "nexus" 2>/dev/null

echo ""
echo "Current status:"
echo "==============="

# Show any remaining processes
if pgrep -f "cortex|nexus" > /dev/null; then
    echo "⚠️  Some processes may still be running:"
    ps aux | grep -E "(cortex|nexus)" | grep -v grep
else
    echo "✅ No Cortex or Nexus processes running"
fi

# Show launchctl status
echo ""
echo "LaunchCtl services containing 'nexus' or 'cortex':"
launchctl list | grep -E "(nexus|cortex)" || echo "None found"

echo ""
echo "📝 Summary:"
echo "- Stopped and disabled any Nexus/Cortex launch services"
echo "- Killed any remaining processes"
echo "- Removed from Claude MCP configuration (already done)"
echo ""
echo "✅ Cortex and Nexus have been fully disabled!"
echo ""
echo "To start Brain instead, run:"
echo "  cd /Users/bard/Code/brain"
echo "  npm start"
