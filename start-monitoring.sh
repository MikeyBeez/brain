#!/bin/bash
# Brain Monitoring Services Startup Script

echo "Starting Brain Monitoring Services..."

# Function to check if a port is in use
check_port() {
    lsof -i :$1 > /dev/null 2>&1
    return $?
}

# Kill any existing servers on these ports
if check_port 9996; then
    echo "Killing existing process on port 9996..."
    lsof -ti :9996 | xargs kill -9 2>/dev/null
    sleep 1
fi

if check_port 9998; then
    echo "Killing existing process on port 9998..."
    lsof -ti :9998 | xargs kill -9 2>/dev/null
    sleep 1
fi

# Start the Brain Execution API (port 9998)
echo "Starting Brain Execution API on port 9998..."
cd /Users/bard/Code/brain/api
nohup python3 execution_log_api_fixed.py > /tmp/brain-api.log 2>&1 &
API_PID=$!
echo "Brain API started with PID: $API_PID"

# Wait a moment for the API to start
sleep 2

# Start the Execution Monitor Web Server (port 9996)
echo "Starting Execution Monitor on port 9996..."
nohup python3 serve-monitor.py > /tmp/brain-monitor.log 2>&1 &
MONITOR_PID=$!
echo "Monitor started with PID: $MONITOR_PID"

# Wait and check if services started successfully
sleep 2

if check_port 9998; then
    echo "✅ Brain Execution API is running on port 9998"
else
    echo "❌ Failed to start Brain Execution API"
fi

if check_port 9996; then
    echo "✅ Execution Monitor is running on port 9996"
    echo ""
    echo "🎉 All services started successfully!"
    echo "📊 Monitor URL: http://localhost:9996/execution-monitor.html"
else
    echo "❌ Failed to start Execution Monitor"
fi

echo ""
echo "Log files:"
echo "  - API log: /tmp/brain-api.log"
echo "  - Monitor log: /tmp/brain-monitor.log"
