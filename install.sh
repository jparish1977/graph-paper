#!/bin/bash
set -e

sudo apt-get update
sudo apt-get install -y python3 python3-pip python3-tk
pip3 install Pillow

echo "Done. Run with: python3 graph_paper_ui.py"
