#!/usr/bin/env python3
"""
Fixed Brain Execution Log API Server

Properly handles execution details without double-prefixing.
"""

import json
import os
import glob
from datetime import datetime
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qs

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
                "version": "1.0.2",
                "endpoints": [
                    "/health - API health check",
                    "/api/brain/executions - List recent executions",
                    "/api/brain/executions/{id} - Get specific execution log",
                ],
                "log_dir": LOG_DIR
            }).encode())
        elif parsed_path.path == '/api/brain/executions':
            self.handle_list_executions()
        elif parsed_path.path.startswith('/api/brain/executions/'):
            execution_id = parsed_path.path.split('/')[-1]
            self.handle_get_execution(execution_id)
        elif parsed_path.path == '/health':
            self.wfile.write(json.dumps({
                "status": "healthy",
                "service": "brain-execution-api",
                "version": "1.0.2",
                "log_dir": LOG_DIR
            }).encode())
        else:
            self.wfile.write(json.dumps({"error": "Unknown endpoint"}).encode())
    
    def read_execution_log(self, log_file):
        """Read execution log from line-by-line format"""
        data = {}
        try:
            with open(log_file, 'r') as f:
                for line in f:
                    if line.strip():
                        try:
                            entry = json.loads(line)
                            data.update(entry)
                        except:
                            pass
        except:
            pass
        return data
    
    def handle_list_executions(self):
        """List recent execution logs"""
        try:
            os.makedirs(LOG_DIR, exist_ok=True)
            log_files = glob.glob(os.path.join(LOG_DIR, "exec_*.json"))
            executions = []
            
            for log_file in sorted(log_files, reverse=True)[:20]:
                data = self.read_execution_log(log_file)
                if data.get('execution_id'):
                    executions.append({
                        "id": data.get('execution_id'),
                        "timestamp": data.get('timestamp'),
                        "language": data.get('language', 'unknown'),
                        "status": data.get('status', 'completed'),
                        "description": data.get('description', ''),
                        "file": os.path.basename(log_file)
                    })
            
            self.wfile.write(json.dumps({
                "executions": executions,
                "count": len(executions)
            }).encode())
        except Exception as e:
            self.wfile.write(json.dumps({"error": str(e)}).encode())
    
    def handle_get_execution(self, execution_id):
        """Get specific execution log details"""
        try:
            # Remove any 'exec-' or 'exec_' prefix from the ID
            clean_id = execution_id.replace('exec-', '').replace('exec_', '')
            
            # Try different file patterns
            possible_files = [
                os.path.join(LOG_DIR, f"exec_{clean_id}.json"),
                os.path.join(LOG_DIR, f"exec_{execution_id}.json"),
                os.path.join(LOG_DIR, f"{execution_id}.json"),
            ]
            
            log_file = None
            for pf in possible_files:
                if os.path.exists(pf):
                    log_file = pf
                    break
            
            if not log_file:
                self.wfile.write(json.dumps({"error": "Execution not found"}).encode())
                return
            
            # Read the full execution data
            data = self.read_execution_log(log_file)
            
            # Format the response
            response = {
                "id": data.get('execution_id', execution_id),
                "timestamp": data.get('timestamp'),
                "type": data.get('language', 'unknown'),
                "description": data.get('description', ''),
                "code": data.get('code', ''),
                "output": data.get('output', ''),
                "error": data.get('error', ''),
                "status": data.get('status', 'completed'),
                "execution_time": data.get('execution_time', 0)
            }
            
            self.wfile.write(json.dumps(response).encode())
        except Exception as e:
            self.wfile.write(json.dumps({"error": str(e)}).encode())
    
    def log_message(self, format, *args):
        # Suppress request logging
        pass

def main():
    print(f"Starting Fixed Brain Execution API on port {PORT}")
    print(f"Log directory: {LOG_DIR}")
    httpd = HTTPServer(('', PORT), LogAPIHandler)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")

if __name__ == '__main__':
    main()
