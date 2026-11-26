#!/data/data/com.termux/files/usr/bin/bash
# Setup script for Huawei POT-LX1 (Termux)
set -e
pkg update -y
pkg install -y python iputils
pip install --no-cache-dir -r requirements.txt
termux-wake-lock || true
echo "Setup complete! Copy config.example.json to config.json, edit your passwords/URL, and run:"
echo "  python monitor.py"
