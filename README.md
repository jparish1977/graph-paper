# Graph Paper Builder — Double Dungeons Edition

A printable graph paper generator with a GUI, built for mapping dungeons in the TurboGrafx-16 game *Double Dungeons*.

## Features

- Configurable page size, grid spacing (1/8", 3/16", 1/4", 5/16"), margins, and DPI
- Adjustable box interval (in grid cells) with heavy lines for easy square-counting
- Dashed or solid grid lines
- Title block with customizable text
- Optional notes area at the bottom with ruled lines
- Dungeon border rectangle with start position marker and dungeon-relative coordinate labels
- Multi-sheet assembly guides — print on Letter paper and tape sheets together
- Presets for all Double Dungeons levels (sizes approximate) — stored in `dungeon_presets.json`, editable and saveable from the UI
- Supports large-format plotters (DesignJet T125 24" roll)
- Print button for direct printing (PNG on Windows, PDF on Linux/Mac)

## Requirements

- Python 3.8+
- Pillow
- Tkinter (included with most Python installs)

## Install & Run

### Ubuntu / Debian

```bash
git clone https://github.com/jparish1977/graph-paper.git
cd graph-paper
bash install.sh
python3 graph_paper_ui.py
```

> `install.sh` installs `python3-pil.imagetk` alongside Pillow — this is required for the image preview to work in the UI and isn't included with pip's Pillow alone.

### Windows

```
pip install Pillow
python graph_paper_ui.py
```

> Tkinter is included with the standard Windows Python installer from python.org. If it's missing, reinstall Python and make sure "tcl/tk and IDLE" is checked.

## Usage

1. Select a **Double Dungeons preset** to auto-configure page size, grid spacing, dungeon border, and sheet count
2. Adjust grid spacing, box interval, colors, and DPI as needed
3. Enable **Notes area** if you want ruled lines at the bottom for mapping notes
4. Click **Generate & Save** — multi-sheet layouts export as a multi-page PDF or numbered PNGs
5. Click **Print** to send directly to your printer
6. Print and tape sheets together using the cut/tape guides on each sheet
