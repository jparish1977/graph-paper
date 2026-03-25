#!/usr/bin/env python3
"""Generate printable graph paper image/PDF."""
from PIL import Image, ImageDraw, ImageFont


def _scaled_font(size):
    try:
        return ImageFont.load_default(size=max(1, size))
    except TypeError:
        return ImageFont.load_default()


def index_label_from_num(n):
    s = ""
    while True:
        s = chr(ord("A") + (n % 26)) + s
        n = n // 26 - 1
        if n < 0:
            break
    return s


def draw_dashed_line(draw, start, end, color, width=1, dash_length=8, gap_length=8):
    x1, y1 = start
    x2, y2 = end
    dx, dy = x2 - x1, y2 - y1
    length = (dx*dx + dy*dy) ** 0.5
    if length == 0:
        return
    ux, uy = dx / length, dy / length
    pos = 0
    while pos < length:
        dash_end = min(pos + dash_length, length)
        draw.line([(x1 + ux*pos, y1 + uy*pos), (x1 + ux*dash_end, y1 + uy*dash_end)],
                  fill=color, width=width)
        pos += dash_length + gap_length


def _draw_rotated_label(img, text, fill, font, cx, cy):
    """Draw text rotated 90°, centered at (cx, cy), within the image bounds."""
    tmp = Image.new("RGBA", (1, 1))
    bbox = ImageDraw.Draw(tmp).textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    txt_img = Image.new("RGBA", (tw + 4, th + 4), (0, 0, 0, 0))
    ImageDraw.Draw(txt_img).text((2, 2), text, fill=fill, font=font)
    rotated = txt_img.rotate(90, expand=True)
    px = max(0, cx - rotated.width // 2)
    py = max(0, cy - rotated.height // 2)
    img.paste(rotated, (px, py), rotated)


def generate_graph_paper(
    width_in=24, height_in=36, dpi=300,
    line_color=(173, 216, 230), heavy_color=(173, 216, 230),
    index_color=(40, 60, 120), line_thickness=1, heavy_thickness=2,
    margin_in=0.25, grid_size_in=0.25, box_size_in=1.0,
    font_size=None, dashed=True,
    title_lines=None,
    sheet_col=0, sheet_row=0, sheets_wide=1, sheets_tall=1, tab_in=0.25,
    notes_bottom_in=0.0,
    start_col=None, start_row=None,    # 1-indexed grid squares from top-left
    dungeon_cols=None, dungeon_rows=None,  # total dungeon size in grid squares
):
    width_px  = int(width_in  * dpi)
    height_px = int(height_in * dpi)
    margin_px = int(margin_in * dpi)
    grid_px      = max(1, int(grid_size_in * dpi))
    box_px       = max(grid_px, int(box_size_in * dpi))
    grid_per_box = max(1, round(box_px / grid_px))  # grid steps per box interval
    tab_px    = int(tab_in * dpi) if (sheets_wide > 1 or sheets_tall > 1) else 0
    # notes only on the bottom row of sheets
    notes_px  = int(notes_bottom_in * dpi) if sheet_row == sheets_tall - 1 else 0

    dash_length = max(4, int(dpi * 0.045))
    gap_length  = dash_length

    if font_size is None:
        font_size = max(1, int(box_px * 0.18))
    font = _scaled_font(font_size)

    label_font_size = max(1, grid_px // 2)
    label_font  = _scaled_font(label_font_size)
    label_color = (180, 180, 180)

    # title block font: fit n_lines inside one box height
    if title_lines is None:
        title_lines = [
            "Ginger Plays Games",
            "Draft",
            f"{width_in:.4g}\u00d7{height_in:.4g} in",
            f"{dpi} DPI",
        ]
    n_lines    = max(1, len(title_lines))
    pad_inner  = max(2, box_px // 12)
    line_gap   = max(1, box_px // 20)
    max_tf     = max(1, (box_px - pad_inner) // n_lines - line_gap)
    title_font_size = min(max(1, int(box_px * 0.22)), max_tf)
    title_font = _scaled_font(title_font_size)

    # ── multi-sheet grid offset ──────────────────────────────────────────
    usable_w_px  = width_px  - 2 * margin_px
    usable_h_px  = height_px - 2 * margin_px - notes_px
    content_w_px = max(1, usable_w_px - tab_px)
    content_h_px = max(1, usable_h_px - tab_px)

    x_abs_base = sheet_col * content_w_px
    y_abs_base = sheet_row * content_h_px

    x_phase = x_abs_base % grid_px
    y_phase = y_abs_base % grid_px
    grid_x0 = margin_px + (grid_px - x_phase) % grid_px
    grid_y0 = margin_px + (grid_px - y_phase) % grid_px

    # bottom of the grid area (above notes strip)
    grid_bottom = height_px - margin_px - notes_px

    # ── image setup ──────────────────────────────────────────────────────
    print(f"Sheet ({sheet_col},{sheet_row}) of {sheets_wide}×{sheets_tall} — "
          f"{width_in}×{height_in}in @ {dpi} DPI")
    img  = Image.new("RGB", (width_px, height_px), "white")
    draw = ImageDraw.Draw(img)

    # ── tab zone shading ─────────────────────────────────────────────────
    tab_fill = (210, 230, 255)
    if tab_px > 0:
        if sheet_col > 0:
            draw.rectangle([margin_px, margin_px,
                            margin_px + tab_px, grid_bottom], fill=tab_fill)
        if sheet_row > 0:
            draw.rectangle([margin_px, margin_px,
                            width_px - margin_px, margin_px + tab_px], fill=tab_fill)

    # ── grid lines ───────────────────────────────────────────────────────
    def draw_line(start, end, color, w):
        if dashed:
            draw_dashed_line(draw, start, end, color, width=w,
                             dash_length=dash_length, gap_length=gap_length)
        else:
            draw.line([start, end], fill=color, width=w)

    x = grid_x0
    while x <= width_px - margin_px:
        abs_x = (x - margin_px) + x_abs_base
        if (abs_x // grid_px) % grid_per_box == 0:
            draw_line((x, margin_px), (x, grid_bottom), heavy_color, heavy_thickness)
        else:
            draw_line((x, margin_px), (x, grid_bottom), line_color, line_thickness)
        x += grid_px

    y = grid_y0
    while y <= grid_bottom:
        abs_y = (y - margin_px) + y_abs_base
        if (abs_y // grid_px) % grid_per_box == 0:
            draw_line((margin_px, y), (width_px - margin_px, y), heavy_color, heavy_thickness)
        else:
            draw_line((margin_px, y), (width_px - margin_px, y), line_color, line_thickness)
        y += grid_px

    # ── cut guides on tab zones ───────────────────────────────────────────
    if tab_px > 0:
        cut_color  = (200, 40, 40)
        cut_w      = max(1, heavy_thickness)
        guide_dash = max(4, dpi // 15)

        if sheet_col > 0:
            cx = margin_px + tab_px
            draw_dashed_line(draw, (cx, 0), (cx, height_px),
                             cut_color, width=cut_w,
                             dash_length=guide_dash, gap_length=guide_dash)
            # rotate text to fit entirely within the tab strip
            _draw_rotated_label(img, "CUT / TAPE UNDER", cut_color, font,
                                cx=margin_px + tab_px // 2, cy=height_px // 2)

        if sheet_row > 0:
            cy = margin_px + tab_px
            draw_dashed_line(draw, (0, cy), (width_px, cy),
                             cut_color, width=cut_w,
                             dash_length=guide_dash, gap_length=guide_dash)
            draw.text((width_px // 2, margin_px + tab_px // 2),
                      "CUT / TAPE UNDER", fill=cut_color, font=font, anchor="mm")

    # ── index labels ─────────────────────────────────────────────────────
    label_cy = margin_px // 2           # vertical centre for column labels
    label_cx = margin_px // 2           # horizontal centre for row labels

    x = grid_x0
    while x <= width_px - margin_px:
        abs_x = (x - margin_px) + x_abs_base
        if (abs_x // grid_px) % grid_per_box == 0:
            cx = x + grid_px // 2
            draw.text((cx, label_cy), index_label_from_num(abs_x // grid_px),
                      fill=label_color, font=label_font, anchor="mm")
        x += grid_px

    y = grid_y0
    while y <= grid_bottom:
        abs_y = (y - margin_px) + y_abs_base
        if (abs_y // grid_px) % grid_per_box == 0:
            cy = y + grid_px // 2
            draw.text((label_cx, cy), str(abs_y // grid_px + 1),
                      fill=label_color, font=label_font, anchor="mm")
        y += grid_px

    # ── title block — only on top-left sheet ─────────────────────────────
    if sheet_col == 0 and sheet_row == 0:
        block_w = box_px * 2
        block_h = box_px
        radius = max(2, box_px // 8)
        draw.rounded_rectangle([margin_px, margin_px,
                                 margin_px + block_w, margin_px + block_h],
                                radius=radius, outline=(0, 0, 0),
                                width=max(1, heavy_thickness))
        block_cx = margin_px + block_w // 2
        active_lines = [l for l in title_lines if l.strip()]
        n_active = max(1, len(active_lines))
        total_text_h = n_active * title_font_size + (n_active - 1) * line_gap
        text_y = margin_px + (block_h - total_text_h) // 2
        for line in active_lines:
            draw.text((block_cx, text_y + title_font_size // 2), line,
                      fill=(0, 0, 0), font=title_font, anchor="mm")
            text_y += title_font_size + line_gap

    # ── sheet label (bottom-right, inside margin) ─────────────────────────
    if sheets_wide > 1 or sheets_tall > 1:
        sheet_label = f"Sheet {index_label_from_num(sheet_col)}{sheet_row + 1}"
        draw.text((width_px - margin_px - box_px,
                   height_px - margin_px - font_size - 2),
                  sheet_label, fill=index_color, font=font)

    # ── dungeon border + start marker ────────────────────────────────────
    # Dungeon origin: one box below top margin (clears title block), centered
    # horizontally and vertically across the full assembled sheet area,
    # snapped to the nearest grid line.
    dung_origin_y = box_px  # minimum y offset below top margin

    if dungeon_cols and dungeon_rows:
        total_w = sheets_wide * content_w_px
        total_h = sheets_tall * content_h_px - dung_origin_y
        dung_w  = dungeon_cols * grid_px
        dung_h  = dungeon_rows * grid_px
        # centre offset, snapped to grid
        raw_x = max(0, (total_w - dung_w) // 2)
        raw_y = max(0, (total_h - dung_h) // 2)
        dung_x_off = (raw_x // grid_px) * grid_px
        dung_y_off = (raw_y // grid_px) * grid_px

        border_color = (60, 60, 60)
        border_w = max(2, heavy_thickness + 1)
        lx = margin_px + dung_x_off                          - x_abs_base
        ty = margin_px + dung_origin_y + dung_y_off          - y_abs_base
        rx = margin_px + dung_x_off + dung_w                 - x_abs_base
        by = margin_px + dung_origin_y + dung_y_off + dung_h - y_abs_base
        sx0, sy0 = margin_px, margin_px
        sx1, sy1 = width_px - margin_px, grid_bottom

        def hline(y, x0, x1):
            x0, x1 = max(x0, sx0), min(x1, sx1)
            if x0 < x1:
                draw.line([(x0, y), (x1, y)], fill=border_color, width=border_w)

        def vline(x, y0, y1):
            y0, y1 = max(y0, sy0), min(y1, sy1)
            if y0 < y1:
                draw.line([(x, y0), (x, y1)], fill=border_color, width=border_w)

        if sy0 <= ty <= sy1: hline(ty, lx, rx)
        if sy0 <= by <= sy1: hline(by, lx, rx)
        if sx0 <= lx <= sx1: vline(lx, ty, by)
        if sx0 <= rx <= sx1: vline(rx, ty, by)

        # ── dungeon-relative labels ───────────────────────────────────────
        dlabel_color = index_color

        # column letters just above the top border
        if sy0 <= ty <= sy1:
            ly = ty - grid_px // 2
            if ly >= 0:
                x = lx
                while x < rx:
                    if sx0 <= x + grid_px // 2 <= sx1:
                        col_idx = (x - lx) // grid_px
                        draw.text((x + grid_px // 2, ly),
                                  index_label_from_num(col_idx),
                                  fill=dlabel_color, font=label_font, anchor="mm")
                    x += grid_px

        # row numbers just left of the left border
        if sx0 <= lx <= sx1:
            lx2 = lx - grid_px // 2
            if lx2 >= 0:
                y = ty
                while y < by:
                    if sy0 <= y + grid_px // 2 <= sy1:
                        row_idx = (y - ty) // grid_px + 1
                        draw.text((lx2, y + grid_px // 2),
                                  str(row_idx),
                                  fill=dlabel_color, font=label_font, anchor="mm")
                    y += grid_px
    else:
        dung_x_off = 0
        dung_y_off = 0

    # ── start position marker ────────────────────────────────────────────
    if start_col is not None and start_row is not None:
        abs_sx = dung_x_off + (start_col - 1) * grid_px
        abs_sy = dung_y_off + (start_row - 1) * grid_px
        local_sx = margin_px + (abs_sx - x_abs_base)
        local_sy = margin_px + dung_origin_y + (abs_sy - y_abs_base)
        # only draw if the cell is on this sheet
        if (margin_px <= local_sx < width_px - margin_px and
                margin_px <= local_sy < grid_bottom):
            draw.rectangle([local_sx, local_sy,
                            local_sx + grid_px, local_sy + grid_px],
                           fill=(255, 255, 180))   # very light yellow
            draw.text((local_sx + 2, local_sy + 1), "S",
                      fill=(180, 120, 0), font=font)

    # ── notes area ───────────────────────────────────────────────────────
    if notes_px > 0:
        rule_px = max(grid_px, int(0.25 * dpi))
        draw.line([(margin_px, grid_bottom), (width_px - margin_px, grid_bottom)],
                  fill=(0, 0, 0), width=max(1, heavy_thickness))
        notes_label_x = margin_px + (tab_px if sheet_col > 0 else 0) + pad_inner
        draw.text((notes_label_x, grid_bottom + pad_inner),
                  "Notes", fill=index_color, font=font)
        y = grid_bottom + rule_px
        while y <= height_px - margin_px:
            draw.line([(margin_px, y), (width_px - margin_px, y)],
                      fill=line_color, width=line_thickness)
            y += rule_px

    return img


def generate_all_sheets(sheets_wide, sheets_tall, **kwargs):
    """Generate all sheets for a multi-sheet layout, return list of PIL Images."""
    images = []
    for row in range(sheets_tall):
        for col in range(sheets_wide):
            img = generate_graph_paper(
                sheet_col=col, sheet_row=row,
                sheets_wide=sheets_wide, sheets_tall=sheets_tall,
                **kwargs,
            )
            images.append((col, row, img))
    return images


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Generate printable graph paper.")
    parser.add_argument("--width-in",    type=float, default=24.0)
    parser.add_argument("--height-in",   type=float, default=36.0)
    parser.add_argument("--dpi",         type=int,   default=150)
    parser.add_argument("--output",      default="graph_paper.png")
    parser.add_argument("--margin-in",   type=float, default=0.25)
    parser.add_argument("--grid-size-in",type=float, default=0.25)
    parser.add_argument("--box-size-in", type=float, default=1.0)
    parser.add_argument("--font-size",   type=int,   default=None)
    args = parser.parse_args()

    img = generate_graph_paper(
        width_in=args.width_in, height_in=args.height_in,
        dpi=args.dpi, margin_in=args.margin_in,
        grid_size_in=args.grid_size_in, box_size_in=args.box_size_in,
        font_size=args.font_size,
    )
    out = args.output
    if out.lower().endswith(".pdf"):
        img.save(out, "PDF", resolution=args.dpi)
    else:
        img.save(out)
    print(f"Saved: {out}")


if __name__ == "__main__":
    main()
