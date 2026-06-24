#!/bin/bash

echo "========================================"
echo "mocopi UDP to Railway WebSocket Forwarder"
echo "========================================"
echo ""
echo "This script forwards mocopi UDP data to Railway"
echo ""
echo "Setup:"
echo "  1. Configure mocopi app to send UDP to this machine's IP on port 12351"
echo "  2. Spectacles will connect to: wss://mocopy-railway-service-production.up.railway.app"
echo ""
echo "Starting forwarder..."
echo ""

python3 server_forwarder.py
