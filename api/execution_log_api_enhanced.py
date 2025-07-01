#!/usr/bin/env python3
"""
Brain Execution Log API Server (Enhanced)

Provides HTTP endpoints for Monitex to access Brain execution logs.
Runs on port 9998 (one below Monitex).

Enhanced features:
- Shows last 50 executions (not just 20)
- Better formatting of code and output
- Proper handling of multiline content
- More detailed execution information
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
                "version": "1.1.0",
                "endpoints": [
                    "/health - API health check",
                    "/api/brain/executions - List recent executions",
                    "/api/brain/executions/{id} - Get specific execution log",
                    "/api/brain/executions/latest - Get latest log entries",
                    "/api/brain/executions/all - Get all execution entries (last 100)"
                ],
                "log_dir": LOG_DIR
            }).encode())
        elif parsed_path.path == '/api/brain/executions':
            # List recent executions
            self.handle_list_executions()
        elif parsed_path.path.startswith('/api/brain/executions/'):
            endpoint = parsed_path.path.split('/')[-1]
            if endpoint == 'latest':
                self.handle_latest_updates()
            elif endpoint == 'all':
                self.handle_all_entries()
            else:
                # Get specific execution log
                self.handle_get_execution(endpoint)
        elif parsed_path.path == '/health':
            # Health check endpoint
            self.wfile.write(json.dumps({
                "status": "healthy",
                "service": "brain-execution-api",
                "version": "1.1.0",
                "log_dir": LOG_DIR
            }).encode())
        else:
            self.wfile.write(json.dumps({
                "error": "Unknown endpoint"
            }).encode())
    
    def get_execution_summary(self, log_file):
        """Get a comprehensive summary of an execution"""
        status = "running"
        timestamp = None
        execution_id = None
        language = "unknown"
        code_preview = ""
        output_preview = ""
        error_preview = ""
        description = ""
        
        try:
            with open(log_file, 'r') as f:
                for line in f:
                    if line.strip():
                        try:
                            entry = json.loads(line)
                            if 'execution_id' in entry:
                                execution_id = entry['execution_id']
                            if 'language' in entry:
                                language = entry['language']
                            if 'status' in entry:
                                status = entry['status']
                            if 'timestamp' in entry:
                                timestamp = entry['timestamp']
                            
                            # Capture content previews
                            if entry.get('type') == 'code':
                                code_preview = entry.get('code', '')[:200]
                                description = entry.get('message', '')
                            elif entry.get('type') == 'output':
                                output_text = entry.get('output', '')
                                if output_text:
                                    # Split output and errors
                                    if '\n\nErrors:\n' in output_text:
                                        output_part, error_part = output_text.split('\n\nErrors:\n', 1)
                                        output_preview = output_part[:200]
                                        error_preview = error_part[:200]
                                    else:
                                        output_preview = output_text[:200]
                        except:
                            pass
        except:
            pass
        
        return {
            "id": execution_id,
            "timestamp": timestamp,
            "language": language,
            "status": status,
            "description": description,
            "code_preview": code_preview,
            "output_preview": output_preview,
            "error_preview": error_preview,
            "file": os.path.basename(log_file)
        }
    
    def handle_list_executions(self):
        """List recent execution logs with detailed information"""
        try:
            os.makedirs(LOG_DIR, exist_ok=True)
            
            # Get ALL execution log files, sorted by modification time
            log_files = glob.glob(os.path.join(LOG_DIR, "exec_*.json"))
            log_files.sort(key=os.path.getmtime, reverse=True)
            
            executions = []
            # Show last 50 executions (not just 20)
            for log_file in log_files[:50]:
                execution_info = self.get_execution_summary(log_file)
                if execution_info['id']:
                    executions.append(execution_info)
            
            self.wfile.write(json.dumps({
                "executions": executions,
                "count": len(executions),
                "total_available": len(log_files)
            }).encode())
        except Exception as e:
            self.wfile.write(json.dumps({
                "error": str(e)
            }).encode())
    
    def handle_get_execution(self, execution_id):
        """Get specific execution log with full details"""
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
                            entry = json.loads(line)
                            # Ensure code and output are properly formatted
                            if 'code' in entry:
                                entry['code'] = entry['code'].strip()
                            if 'output' in entry:
                                entry['output'] = entry['output'].strip()
                            entries.append(entry)
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
            log_files = glob.glob(os.path.join(LOG_DIR, "exec_*.json"))
            if not log_files:
                self.wfile.write(json.dumps({
                    "entries": [],
                    "count": 0
                }).encode())
                return
            
            # Sort by modification time to get most recent
            log_files.sort(key=os.path.getmtime, reverse=True)
            
            # Collect last 50 entries across all recent files
            all_entries = []
            for log_file in log_files[:10]:  # Check last 10 files
                with open(log_file, 'r') as f:
                    file_entries = []
                    for line in f:
                        if line.strip():
                            try:
                                entry = json.loads(line)
                                file_entries.append(entry)
                            except:
                                pass
                    all_entries.extend(file_entries[-10:])  # Last 10 from each file
            
            # Sort by timestamp and get last 50
            all_entries.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
            latest_entries = all_entries[:50]
            
            self.wfile.write(json.dumps({
                "entries": latest_entries,
                "count": len(latest_entries)
            }).encode())
        except Exception as e:
            self.wfile.write(json.dumps({
                "error": str(e)
            }).encode())
    
    def handle_all_entries(self):
        """Get all execution entries from recent logs"""
        try:
            log_files = glob.glob(os.path.join(LOG_DIR, "exec_*.json"))
            log_files.sort(key=os.path.getmtime, reverse=True)
            
            all_entries = []
            for log_file in log_files[:20]:  # Last 20 execution files
                with open(log_file, 'r') as f:
                    for line in f:
                        if line.strip():
                            try:
                                entry = json.loads(line)
                                all_entries.append(entry)
                            except:
                                pass
            
            # Sort by timestamp
            all_entries.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
            
            self.wfile.write(json.dumps({
                "entries": all_entries[:100],  # Limit to 100 entries
                "count": len(all_entries[:100]),
                "total_available": len(all_entries)
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
    print("Enhanced version 1.1.0 - Better formatting and more data")
    server.serve_forever()

if __name__ == "__main__":
    run_server()
