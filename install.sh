#!/bin/bash
set -e

sudo apt-get update
sudo apt-get install -y python3 python3-pip python3-tk python3-pil python3-pil.imagetk
pip3 install --upgrade Pillow

echo "Done. Run with: python3 graph_paper_ui.py"
