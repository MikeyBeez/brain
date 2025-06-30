#!/usr/bin/env python3
"""
Brain Execution Log API Server

Provides HTTP endpoints for Monitex to access Brain execution logs.
Runs on port 9998 (one below Monitex).
"""

import json
import os
import glob
from datetime import datetime
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qs
import threading
import time

LOG_DIR = "/Users/bard/Code/brain/logs/execution"
PORT = 9998

class LogAPIHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        """Handle GET requests"""
        parsed_path = urlparse(self.path)
        
        # Enable CORS for Monitex
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        
        if parsed_path.path == '/':
            # Root endpoint - show API info
            self.wfile.write(json.dumps({
                "service": "Brain Execution API",
                "version": "1.0.0",
                "endpoints": [
                    "/health - API health check",
                    "/api/brain/executions - List recent executions",
                    "/api/brain/executions/{id} - Get specific execution log",
                    "/api/brain/executions/latest - Get latest log entries"
                ],
                "log_dir": LOG_DIR
            }).encode())
        elif parsed_path.path == '/api/brain/executions':
            # List recent executions
            self.handle_list_executions()
        elif parsed_path.path.startswith('/api/brain/executions/'):
            # Get specific execution log
            execution_id = parsed_path.path.split('/')[-1]
            self.handle_get_execution(execution_id)
        elif parsed_path.path == '/api/brain/executions/latest':
            # Get latest execution updates
            self.handle_latest_updates()
        elif parsed_path.path == '/health':
            # Health check endpoint
            self.wfile.write(json.dumps({
                "status": "healthy",
                "service": "brain-execution-api",
                "log_dir": LOG_DIR
            }).encode())
        else:
            self.wfile.write(json.dumps({
                "error": "Unknown endpoint"
            }).encode())
    
    def handle_list_executions(self):
        """List recent execution logs"""
        try:
            # Create log directory if it doesn't exist
            os.makedirs(LOG_DIR, exist_ok=True)
            
            # Find all execution log files
            log_files = glob.glob(os.path.join(LOG_DIR, "exec_*.json"))
            executions = []
            
            for log_file in sorted(log_files, reverse=True)[:20]:  # Last 20 executions
                try:
                    # Read first line to get metadata
                    with open(log_file, 'r') as f:
                        first_line = f.readline()
                        if first_line:
                            data = json.loads(first_line)
                            executions.append({
                                "id": data.get("execution_id"),
                                "timestamp": data.get("timestamp"),
                                "language": data.get("language", "unknown"),
                                "status": data.get("status", "unknown"),
                                "file": os.path.basename(log_file)
                            })
                except:
                    pass
            
            self.wfile.write(json.dumps({
                "executions": executions,
                "count": len(executions)
            }).encode())
        except Exception as e:
            self.wfile.write(json.dumps({
                "error": str(e)
            }).encode())
    
    def handle_get_execution(self, execution_id):
        """Get specific execution log"""
        try:
            log_file = os.path.join(LOG_DIR, f"exec_{execution_id}.json")
            
            if not os.path.exists(log_file):
                self.wfile.write(json.dumps({
                    "error": "Execution not found"
                }).encode())
                return
            
            # Read all log entries
            entries = []
            with open(log_file, 'r') as f:
                for line in f:
                    if line.strip():
                        try:
                            entries.append(json.loads(line))
                        except:
                            pass
            
            self.wfile.write(json.dumps({
                "execution_id": execution_id,
                "entries": entries,
                "count": len(entries)
            }).encode())
        except Exception as e:
            self.wfile.write(json.dumps({
                "error": str(e)
            }).encode())
    
    def handle_latest_updates(self):
        """Get latest log entries across all executions"""
        try:
            # Find most recent log file
            log_files = glob.glob(os.path.join(LOG_DIR, "exec_*.json"))
            if not log_files:
                self.wfile.write(json.dumps({
                    "entries": [],
                    "count": 0
                }).encode())
                return
            
            latest_file = max(log_files, key=os.path.getmtime)
            
            # Read last 50 lines
            entries = []
            with open(latest_file, 'r') as f:
                lines = f.readlines()
                for line in lines[-50:]:
                    if line.strip():
                        try:
                            entries.append(json.loads(line))
                        except:
                            pass
            
            self.wfile.write(json.dumps({
                "entries": entries,
                "count": len(entries),
                "execution_id": os.path.basename(latest_file).replace("exec_", "").replace(".json", "")
            }).encode())
        except Exception as e:
            self.wfile.write(json.dumps({
                "error": str(e)
            }).encode())
    
    def log_message(self, format, *args):
        """Override to reduce console spam"""
        return

def run_server():
    """Run the API server"""
    server = HTTPServer(('localhost', PORT), LogAPIHandler)
    print(f"Brain Execution API running on port {PORT}")
    print(f"Serving logs from: {LOG_DIR}")
    server.serve_forever()

if __name__ == "__main__":
    run_server()
