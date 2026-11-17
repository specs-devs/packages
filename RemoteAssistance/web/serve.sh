#!/usr/bin/env bash
# Serve the Remote Assistance helper portal on http://localhost:8000.
#
# Run this ON THE HELPER'S machine and open it as http://localhost:8000 —
# localhost is a secure context, so the browser allows microphone/webcam
# access without HTTPS. (Opening it from another machine over plain
# http://<ip>:8000 blocks getUserMedia — serve it locally instead.)
cd "$(dirname "${BASH_SOURCE[0]}")"
echo "Remote Assistance helper portal → http://localhost:8000"
exec python3 -m http.server 8000
