#!/bin/bash
# Check what's actually running

echo "Checking for services with 'mikey' in the name:"
launchctl list | grep -i mikey

echo -e "\nChecking for any Python processes on port 8100 (Nexus port):"
lsof -i :8100

echo -e "\nChecking for uvicorn processes:"
ps aux | grep uvicorn | grep -v grep

echo -e "\nChecking for any cortex processes:"
ps aux | grep -i cortex | grep -v grep

echo -e "\nChecking what's in LaunchAgents:"
ls -la ~/Library/LaunchAgents/ | grep -E "(cortex|nexus|mikey)"
