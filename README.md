# Graph Paper Builder — Double Dungeons Edition

A printable graph paper generator with a GUI, built for mapping dungeons in the TurboGrafx-16 game *Double Dungeons*.

## Features

- Configurable page size, grid spacing, margins, and DPI
- Heavy box interval lines for easy square-counting
- Dashed or solid grid lines
- Title block with customizable text
- Optional notes area at the bottom
- Dungeon border rectangle with start position marker
- Multi-sheet assembly guides — print on Letter paper and tape sheets together
- Presets for all Double Dungeons levels (sizes approximate)
- Supports large-format plotters (DesignJet T125 24" roll)

## Requirements

- Python 3.8+
- Pillow

## Install & Run

### Ubuntu / Debian

```bash
git clone https://github.com/jparish1977/graph-paper.git
cd graph-paper
bash install.sh
python3 graph_paper_ui.py
```

### Windows

```
pip install Pillow
python graph_paper_ui.py
```

## Usage

1. Select a **Double Dungeons preset** to auto-configure page size, dungeon border, and sheet count
2. Adjust grid spacing, colors, and DPI as needed
3. Enable **Notes area** if you want ruled lines at the bottom for mapping notes
4. Click **Generate & Save** — multi-sheet layouts export as a multi-page PDF or numbered PNGs
5. Print and tape sheets together using the cut/tape guides on each sheet
