#!/bin/bash
# Test Brain Execution API endpoints

echo "🧠 Testing Brain Execution API Endpoints"
echo "========================================"
echo ""

# Health check
echo "1. Testing Health Endpoint:"
echo "curl http://localhost:9998/health"
curl -s http://localhost:9998/health | python3 -m json.tool
echo ""

# List executions
echo "2. Testing List Executions:"
echo "curl http://localhost:9998/api/brain/executions"
curl -s http://localhost:9998/api/brain/executions | python3 -m json.tool
echo ""

# Get latest updates
echo "3. Testing Latest Updates:"
echo "curl http://localhost:9998/api/brain/executions/latest"
curl -s http://localhost:9998/api/brain/executions/latest | python3 -m json.tool
echo ""

# Test with a specific execution ID (will fail if no executions exist)
echo "4. Testing Specific Execution (example):"
echo "curl http://localhost:9998/api/brain/executions/test-123"
curl -s http://localhost:9998/api/brain/executions/test-123 | python3 -m json.tool
echo ""

echo "========================================"
echo "To test with real execution data, first create a log file:"
echo "mkdir -p /Users/bard/Code/brain/logs/execution"
echo "Then add a sample log entry..."
