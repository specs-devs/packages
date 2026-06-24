#!/bin/bash
# Start mocopi relay server with file logging
# Logs will be saved to ./logs/ directory

cd "$(dirname "$0")"

echo "=============================================="
echo "mocopi WebSocket Relay Server"
echo "=============================================="
echo ""
echo "Starting server..."
echo "  - UDP listening on port 12351"
echo "  - WebSocket on port 8080"
echo ""
echo "Press Ctrl+C to stop and save logs"
echo "=============================================="
echo ""

# Activate venv if it exists
if [ -d "venv" ]; then
    source venv/bin/activate
fi

# Run the server
python3 server.py

echo ""
echo "Server stopped. Check ./logs/ for log files."
