#!/bin/bash
# Wrapper script to ensure Brain uses the correct Node.js version

# Use Homebrew's Node.js v24.3.0
exec /opt/homebrew/bin/node "$@"
