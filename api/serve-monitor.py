#!/usr/bin/env python3
"""
Serve the Brain Execution Monitor UI
"""

import http.server
import socketserver
import os

PORT = 9996
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)
    
    def do_GET(self):
        # Redirect root to execution monitor
        if self.path == '/':
            self.send_response(301)
            self.send_header('Location', '/execution-monitor.html')
            self.end_headers()
            return
        super().do_GET()
    
    def end_headers(self):
        # Enable CORS
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        super().end_headers()

print(f"Starting Brain Execution Monitor on http://localhost:{PORT}")
print(f"Open http://localhost:{PORT}/ in your browser")

with socketserver.TCPServer(("", PORT), MyHTTPRequestHandler) as httpd:
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")
