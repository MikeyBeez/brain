#!/bin/bash
# Quick commands to stop and disable Nexus and Cortex

# Stop and disable Nexus
echo "Stopping Nexus..."
launchctl stop nexus3 2>/dev/null
launchctl stop nexus 2>/dev/null
launchctl stop com.user.nexus 2>/dev/null

echo "Disabling Nexus..."
launchctl disable nexus3 2>/dev/null
launchctl disable nexus 2>/dev/null
launchctl disable com.user.nexus 2>/dev/null

# Stop and disable Cortex
echo "Stopping Cortex..."
launchctl stop cortex2 2>/dev/null
launchctl stop cortex 2>/dev/null
launchctl stop com.user.cortex 2>/dev/null

echo "Disabling Cortex..."
launchctl disable cortex2 2>/dev/null
launchctl disable cortex 2>/dev/null
launchctl disable com.user.cortex 2>/dev/null

# Kill any remaining processes
pkill -f nexus
pkill -f cortex

echo "Done! Run 'launchctl list | grep -E \"(nexus|cortex)\"' to verify"
