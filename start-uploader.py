#!/usr/bin/env python3
"""
Simple HTTP server to run the image uploader
This allows the browser to load local files
"""

import http.server
import socketserver
import os

PORT = 8080
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)
    
    def end_headers(self):
        # Add CORS headers
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
        super().end_headers()

print(f"""
🚀 Marga Image Uploader - Local Server

Server running at: http://localhost:{PORT}

📋 Next steps:
1. Open your browser
2. Go to: http://localhost:{PORT}/upload-images.html
3. Click "Start Upload"

Press Ctrl+C to stop the server
""")

with socketserver.TCPServer(("", PORT), MyHTTPRequestHandler) as httpd:
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n\n✅ Server stopped")
