#!/bin/bash
# Start the Brain Code Usage Analyzer

echo "🧠 Starting Brain Code Usage Analyzer..."
echo "Port: 9997"
echo "Dashboard: file://$(pwd)/analyzer/dashboard.html"
echo ""

cd "$(dirname "$0")/.."
node analyzer/usage-analyzer-server.js
