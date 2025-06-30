#!/bin/bash
# Quick commands to completely remove Nexus and Cortex

# Unload and remove from launchctl
launchctl unload -w ~/Library/LaunchAgents/com.mikeybee.nexus3.plist
launchctl unload -w ~/Library/LaunchAgents/com.mikeybee.cortex2.plist
launchctl unload -w ~/Library/LaunchAgents/com.mikeybee.cortex2_api.plist

# Remove the services
launchctl remove com.mikeybee.nexus3
launchctl remove com.mikeybee.cortex2
launchctl remove com.mikeybee.cortex2_api

# Delete the plist files
rm -f ~/Library/LaunchAgents/com.mikeybee.nexus3.plist
rm -f ~/Library/LaunchAgents/com.mikeybee.cortex2.plist
rm -f ~/Library/LaunchAgents/com.mikeybee.cortex2_api.plist

# Kill any remaining processes
pkill -f nexus
pkill -f cortex
pkill -f "uvicorn.*8100"

echo "Done! Services removed."
