#!/usr/bin/env python3
"""Tkinter UI for the graph paper generator."""
import tkinter as tk
from tkinter import ttk, filedialog, messagebox, colorchooser
from PIL import Image, ImageTk
import threading
import math
import json
import os

from generate_graph_paper import generate_graph_paper, generate_all_sheets

PRESETS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dungeon_presets.json")


def load_dungeon_presets():
    if os.path.exists(PRESETS_FILE):
        with open(PRESETS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_dungeon_presets(presets):
    with open(PRESETS_FILE, "w", encoding="utf-8") as f:
        json.dump(presets, f, ensure_ascii=False, indent=2)

# ── page presets ─────────────────────────────────────────────────────────────
PAGE_PRESETS = {
    # value: (width_in, height_in, notes_in) or None for separators
    "Custom": None,
    "── Laserjet (Letter) ──": None,
    "Letter (8.5×11)":          (8.5,  11,    1.5),
    "Letter Landscape (11×8.5)":(11,   8.5,   1.0),
    "── DesignJet T125 (24\" roll) ──": None,
    "T125 — 24×36":             (24,   36,    2.0),
    "T125 — 24×48":             (24,   48,    2.0),
    "T125 — 24×60":             (24,   60,    2.5),
    "── Other ──": None,
    "Tabloid (11×17)":          (11,   17,    1.5),
    "Tabloid Landscape (17×11)":(17,   11,    1.5),
    "36×48":                    (36,   48,    2.5),
    "A4 (8.27×11.69)":          (8.27, 11.69, 1.5),
    "A3 (11.69×16.54)":         (11.69,16.54, 1.5),
}

GRID_SIZES = {
    "1/8 inch":  0.125,
    "3/16 inch": 0.1875,
    "1/4 inch":  0.25,
    "5/16 inch": 0.3125,
    "1/2 inch":  0.5,
    "1 inch":    1.0,
}


TAB_SIZES = {
    "1/8 inch (3mm)":  0.125,
    "1/4 inch (6mm)":  0.25,
    "1/2 inch (13mm)": 0.5,
}


PREVIEW_MAX_PX = 1200


def rgb_to_hex(r, g, b):
    return f"#{r:02x}{g:02x}{b:02x}"


def make_combo(parent, row, label, options, default, width=20):
    tk.Label(parent, text=label, anchor="w").grid(row=row, column=0, sticky="w", padx=8, pady=3)
    var = tk.StringVar(value=default)
    ttk.Combobox(parent, textvariable=var, values=list(options),
                 state="readonly", width=width).grid(row=row, column=1, sticky="w", padx=8, pady=3)
    return var


def make_entry(parent, row, label, default, width=7):
    tk.Label(parent, text=label, anchor="w").grid(row=row, column=0, sticky="w", padx=8, pady=3)
    var = tk.StringVar(value=str(default))
    ttk.Entry(parent, textvariable=var, width=width).grid(row=row, column=1, sticky="w", padx=8, pady=3)
    return var


class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Graph Paper Builder — Double Dungeons Edition")
        self.resizable(True, True)
        self.minsize(820, 580)
        self._preview_job   = None
        self._preview_photo = None
        self._preview_base  = None   # last rendered PIL image (fit to canvas at zoom=1)
        self._preview_zoom  = 1.0
        self._last_canvas_size = (0, 0)

        self._line_color  = [173, 216, 230]
        self._heavy_color = [173, 216, 230]
        self._index_color = [40,  60,  120]
        self.dungeon_presets = load_dungeon_presets()

        self.columnconfigure(0, weight=0)
        self.columnconfigure(1, weight=1)
        self.rowconfigure(0, weight=1)

        self._build_controls()
        self._build_preview()
        self._wire_traces()
        self._schedule_preview()

    # ── controls ─────────────────────────────────────────────────────────────
    def _build_controls(self):
        left = tk.Frame(self)
        left.grid(row=0, column=0, sticky="ns", padx=(12, 6), pady=8)

        pad = {"padx": 0, "pady": 4}

        # Double Dungeons preset ──────────────────────────────────────────────
        df = ttk.LabelFrame(left, text="Double Dungeons Preset (approximate)", padding=6)
        df.pack(fill="x", **pad)
        tk.Label(df, text="Dungeon:", anchor="w").grid(row=0, column=0, sticky="w", padx=8, pady=3)
        self.dungeon_var = tk.StringVar(value="— select dungeon —")
        self.dng_cb = ttk.Combobox(df, textvariable=self.dungeon_var,
                                    values=self._preset_names(), state="readonly", width=28)
        self.dng_cb.grid(row=0, column=1, columnspan=2, sticky="w", padx=8, pady=3)
        self.dng_cb.bind("<<ComboboxSelected>>", self._on_dungeon_preset)
        ttk.Button(df, text="Save", width=6, command=self._save_preset).grid(
            row=1, column=1, sticky="w", padx=8, pady=3)
        ttk.Button(df, text="Delete", width=6, command=self._delete_preset).grid(
            row=1, column=2, sticky="w", padx=2, pady=3)

        # Page size ───────────────────────────────────────────────────────────
        pf = ttk.LabelFrame(left, text="Page Size", padding=6)
        pf.pack(fill="x", **pad)

        tk.Label(pf, text="Preset:", anchor="w").grid(row=0, column=0, sticky="w", padx=8, pady=3)
        self.preset_var = tk.StringVar(value="Letter (8.5×11)")
        preset_cb = ttk.Combobox(pf, textvariable=self.preset_var,
                                  values=[k for k in PAGE_PRESETS],
                                  state="readonly", width=26)
        preset_cb.grid(row=0, column=1, columnspan=3, sticky="w", padx=8, pady=3)
        preset_cb.bind("<<ComboboxSelected>>", self._on_preset)

        tk.Label(pf, text="Width (in):", anchor="w").grid(row=1, column=0, sticky="w", padx=8, pady=3)
        self.width_var = tk.StringVar(value="8.5")
        ttk.Entry(pf, textvariable=self.width_var, width=7).grid(row=1, column=1, sticky="w", padx=8, pady=3)
        tk.Label(pf, text="Height (in):", anchor="w").grid(row=1, column=2, sticky="w", padx=8, pady=3)
        self.height_var = tk.StringVar(value="11")
        ttk.Entry(pf, textvariable=self.height_var, width=7).grid(row=1, column=3, sticky="w", padx=8, pady=3)

        tk.Label(pf, text="Margin (in):", anchor="w").grid(row=2, column=0, sticky="w", padx=8, pady=3)
        self.margin_var = tk.StringVar(value="0.25")
        ttk.Entry(pf, textvariable=self.margin_var, width=7).grid(row=2, column=1, sticky="w", padx=8, pady=3)

        # Grid ────────────────────────────────────────────────────────────────
        gf = ttk.LabelFrame(left, text="Grid Options", padding=6)
        gf.pack(fill="x", **pad)

        self.grid_size_var = make_combo(gf, 0, "Grid spacing:", list(GRID_SIZES.keys()), "1/4 inch")
        tk.Label(gf, text="Heavy line every N cells:", anchor="w").grid(row=1, column=0, sticky="w", padx=8, pady=3)
        self.box_cells_var = tk.StringVar(value="4")
        ttk.Spinbox(gf, from_=1, to=200, textvariable=self.box_cells_var, width=5).grid(
            row=1, column=1, sticky="w", padx=8, pady=3)
        self.line_thickness_var  = make_entry(gf, 2, "Line thickness:", "1", width=5)
        self.heavy_thickness_var = make_entry(gf, 3, "Heavy thickness:", "2", width=5)
        self.dashed_var = tk.BooleanVar(value=True)
        ttk.Checkbutton(gf, text="Dashed lines", variable=self.dashed_var,
                        command=self._schedule_preview).grid(row=4, column=0, columnspan=2, sticky="w", padx=8, pady=3)

        # Colors ──────────────────────────────────────────────────────────────
        cf = ttk.LabelFrame(left, text="Colors", padding=6)
        cf.pack(fill="x", **pad)
        self._line_btn  = self._make_color_row(cf, 0, "Grid lines:",   self._line_color)
        self._heavy_btn = self._make_color_row(cf, 1, "Heavy lines:",  self._heavy_color)
        self._index_btn = self._make_color_row(cf, 2, "Labels:",       self._index_color)

        # Title block ─────────────────────────────────────────────────────────
        tf = ttk.LabelFrame(left, text="Title Block", padding=6)
        tf.pack(fill="x", **pad)

        self.title_vars = []
        defaults = ["Ginger Plays Games", "Double Dungeons", "", ""]
        hints    = ["Line 1", "Line 2", "Line 3 ({size} = auto)", "Line 4 ({dpi} = auto)"]
        for i, (d, h) in enumerate(zip(defaults, hints)):
            tk.Label(tf, text=f"{h}:", anchor="w").grid(row=i, column=0, sticky="w", padx=8, pady=2)
            var = tk.StringVar(value=d)
            ttk.Entry(tf, textvariable=var, width=22).grid(row=i, column=1, sticky="w", padx=8, pady=2)
            self.title_vars.append(var)

        # Multi-sheet / tabs ──────────────────────────────────────────────────
        mf = ttk.LabelFrame(left, text="Multi-Sheet Assembly", padding=6)
        mf.pack(fill="x", **pad)

        tk.Label(mf, text="Sheets wide:", anchor="w").grid(row=0, column=0, sticky="w", padx=8, pady=3)
        self.sheets_wide_var = tk.StringVar(value="1")
        ttk.Spinbox(mf, from_=1, to=10, textvariable=self.sheets_wide_var, width=4).grid(
            row=0, column=1, sticky="w", padx=8, pady=3)
        tk.Label(mf, text="Sheets tall:", anchor="w").grid(row=0, column=2, sticky="w", padx=8, pady=3)
        self.sheets_tall_var = tk.StringVar(value="1")
        ttk.Spinbox(mf, from_=1, to=10, textvariable=self.sheets_tall_var, width=4).grid(
            row=0, column=3, sticky="w", padx=8, pady=3)

        self.tab_size_var = make_combo(mf, 1, "Tab overlap:", list(TAB_SIZES.keys()), "1/4 inch (6mm)", width=18)

        tk.Label(mf, text="Assembly:", anchor="w").grid(row=2, column=0, sticky="w", padx=8, pady=3)
        self.tab_style_var = tk.StringVar(value="tape")
        ttk.Combobox(mf, textvariable=self.tab_style_var,
                     values=["tape", "insert"], state="readonly", width=10).grid(
            row=2, column=1, columnspan=3, sticky="w", padx=8, pady=3)
        self._tab_hint = tk.Label(mf, text="Cut shaded edge, tape under neighbour sheet.",
                                  fg="gray", justify="left", wraplength=260)
        self._tab_hint.grid(row=3, column=0, columnspan=4, sticky="w", padx=8, pady=2)
        self.tab_style_var.trace_add("write", self._on_tab_style)

        tk.Label(mf, text="Dungeon size (squares):", anchor="w").grid(row=3, column=0, sticky="w", padx=8, pady=3)
        self.dungeon_cols_var = tk.StringVar(value="")
        ttk.Entry(mf, textvariable=self.dungeon_cols_var, width=5).grid(row=3, column=1, sticky="w", padx=8, pady=3)
        tk.Label(mf, text="×", anchor="w").grid(row=3, column=2, sticky="w")
        self.dungeon_rows_var = tk.StringVar(value="")
        ttk.Entry(mf, textvariable=self.dungeon_rows_var, width=5).grid(row=3, column=3, sticky="w", padx=8, pady=3)

        tk.Label(mf, text="Start square col:", anchor="w").grid(row=4, column=0, sticky="w", padx=8, pady=3)
        self.start_col_var = tk.StringVar(value="")
        ttk.Entry(mf, textvariable=self.start_col_var, width=5).grid(row=4, column=1, sticky="w", padx=8, pady=3)
        tk.Label(mf, text="row:", anchor="w").grid(row=4, column=2, sticky="w", padx=8, pady=3)
        self.start_row_var = tk.StringVar(value="")
        ttk.Entry(mf, textvariable=self.start_row_var, width=5).grid(row=4, column=3, sticky="w", padx=8, pady=3)

        # Text & Quality ──────────────────────────────────────────────────────
        qf = ttk.LabelFrame(left, text="Text & Quality", padding=6)
        qf.pack(fill="x", **pad)

        tk.Label(qf, text="Font size (px, blank=auto):", anchor="w").grid(row=0, column=0, sticky="w", padx=8, pady=3)
        self.font_size_var = tk.StringVar(value="")
        ttk.Entry(qf, textvariable=self.font_size_var, width=7).grid(row=0, column=1, sticky="w", padx=8, pady=3)
        self.dpi_var = make_entry(qf, 1, "DPI:", "150", width=7)

        self.notes_enabled_var = tk.BooleanVar(value=False)
        ttk.Checkbutton(qf, text="Notes area", variable=self.notes_enabled_var,
                        command=self._on_notes_toggle).grid(row=2, column=0, sticky="w", padx=8, pady=3)
        self.notes_bottom_var = tk.StringVar(value="1.5")
        self._notes_entry = ttk.Entry(qf, textvariable=self.notes_bottom_var, width=7, state="disabled")
        self._notes_entry.grid(row=2, column=1, sticky="w", padx=8, pady=3)
        tk.Label(qf, text="in", anchor="w").grid(row=2, column=2, sticky="w")

        # Output ──────────────────────────────────────────────────────────────
        of = ttk.LabelFrame(left, text="Output", padding=6)
        of.pack(fill="x", **pad)

        tk.Label(of, text="Format:", anchor="w").grid(row=0, column=0, sticky="w", padx=8, pady=3)
        self.format_var = tk.StringVar(value="PNG")
        fmt_cb = ttk.Combobox(of, textvariable=self.format_var,
                               values=["PNG", "PDF"], state="readonly", width=6)
        fmt_cb.grid(row=0, column=1, sticky="w", padx=8, pady=3)
        fmt_cb.bind("<<ComboboxSelected>>", self._on_format)

        tk.Label(of, text="File:", anchor="w").grid(row=1, column=0, sticky="w", padx=8, pady=3)
        self.output_var = tk.StringVar(value="graph_paper.png")
        ttk.Entry(of, textvariable=self.output_var, width=22).grid(row=1, column=1, sticky="w", padx=8, pady=3)
        ttk.Button(of, text="Browse…", command=self._browse).grid(row=1, column=2, padx=4, pady=3)

        # Buttons ─────────────────────────────────────────────────────────────
        br = tk.Frame(left)
        br.pack(fill="x", pady=(6, 2))
        self.gen_btn = ttk.Button(br, text="Generate & Save", command=self._generate)
        self.gen_btn.pack(side="left", padx=4)
        self.print_btn = ttk.Button(br, text="Print…", command=self._print)
        self.print_btn.pack(side="left", padx=4)

        self.status_var = tk.StringVar(value="Ready.")
        tk.Label(left, textvariable=self.status_var, anchor="w", fg="gray").pack(fill="x", padx=4)

    # ── preview panel ─────────────────────────────────────────────────────────
    def _build_preview(self):
        right = tk.Frame(self, bd=1, relief="sunken", bg="#f0f0f0")
        right.grid(row=0, column=1, sticky="nsew", padx=(6, 12), pady=8)
        right.columnconfigure(0, weight=1)
        right.rowconfigure(1, weight=1)

        tk.Label(right, text="Preview  (scroll to zoom)", bg="#f0f0f0", fg="#555").grid(
            row=0, column=0, pady=(6, 2))

        cf = tk.Frame(right)
        cf.grid(row=1, column=0, sticky="nsew", padx=8, pady=4)
        cf.columnconfigure(0, weight=1)
        cf.rowconfigure(0, weight=1)

        self.canvas = tk.Canvas(cf, bg="white", highlightthickness=1, highlightbackground="#ccc")
        self.canvas.grid(row=0, column=0, sticky="nsew")

        vsb = ttk.Scrollbar(cf, orient="vertical",   command=self.canvas.yview)
        hsb = ttk.Scrollbar(cf, orient="horizontal", command=self.canvas.xview)
        vsb.grid(row=0, column=1, sticky="ns")
        hsb.grid(row=1, column=0, sticky="ew")
        self.canvas.config(xscrollcommand=hsb.set, yscrollcommand=vsb.set)

        self._draw_placeholder()
        self.preview_btn = ttk.Button(right, text="Refresh Preview", command=self._schedule_preview)
        self.preview_btn.grid(row=2, column=0, pady=(4, 8))
        self.canvas.bind("<Configure>", self._on_canvas_resize)
        self.canvas.bind("<MouseWheel>",  self._on_scroll)   # Windows / macOS
        self.canvas.bind("<Button-4>",    self._on_scroll)   # Linux scroll up
        self.canvas.bind("<Button-5>",    self._on_scroll)   # Linux scroll down

    # ── traces ────────────────────────────────────────────────────────────────
    def _wire_traces(self):
        watch = [self.width_var, self.height_var, self.margin_var, self.font_size_var,
                 self.dpi_var, self.output_var, self.grid_size_var, self.box_cells_var,
                 self.preset_var, self.line_thickness_var, self.heavy_thickness_var,
                 self.format_var, self.sheets_wide_var, self.sheets_tall_var,
                 self.tab_size_var, self.notes_bottom_var,
                 self.start_col_var, self.start_row_var,
                 self.dungeon_cols_var, self.dungeon_rows_var] + self.title_vars
        for var in watch:
            var.trace_add("write", lambda *_: self._schedule_preview())

    # ── color helpers ─────────────────────────────────────────────────────────
    def _make_color_row(self, parent, row, label, color_list):
        tk.Label(parent, text=label, anchor="w").grid(row=row, column=0, sticky="w", padx=8, pady=3)
        btn = tk.Button(parent, width=4, relief="solid", bg=rgb_to_hex(*color_list))
        btn.grid(row=row, column=1, sticky="w", padx=8, pady=3)
        btn.config(command=lambda: self._pick_color(color_list, btn))
        return btn

    def _pick_color(self, color_list, btn):
        result = colorchooser.askcolor(color=rgb_to_hex(*color_list), title="Pick a color")
        if result and result[0]:
            r, g, b = (int(x) for x in result[0])
            color_list[:] = [r, g, b]
            btn.config(bg=rgb_to_hex(r, g, b))
            self._schedule_preview()

    # ── helpers ───────────────────────────────────────────────────────────────
    def _canvas_size(self):
        return max(self.canvas.winfo_width(), 100), max(self.canvas.winfo_height(), 100)

    def _draw_placeholder(self):
        self.canvas.delete("all")
        w, h = self._canvas_size()
        self.canvas.create_text(w // 2, h // 2, text="Preview will appear here", fill="#aaa")

    def _on_notes_toggle(self):
        self._notes_entry.config(state="normal" if self.notes_enabled_var.get() else "disabled")
        self._schedule_preview()

    def _on_tab_style(self, *_):
        style = self.tab_style_var.get()
        if style == "insert":
            self._tab_hint.config(
                text="Red: cut comb tabs on strip edge. Green: cut slots on mating edge. "
                     "Tabs insert from behind, fold flat — writing surface stays clean.")
        else:
            self._tab_hint.config(text="Cut shaded edge, tape under neighbour sheet.")
        self._schedule_preview()

    def _on_preset(self, _=None):
        dims = PAGE_PRESETS.get(self.preset_var.get())
        if dims:
            self.width_var.set(str(dims[0]))
            self.height_var.set(str(dims[1]))
            self.notes_bottom_var.set(str(dims[2]))

    def _preset_names(self):
        return ["— select dungeon —"] + list(self.dungeon_presets.keys())

    def _refresh_preset_list(self):
        self.dng_cb["values"] = self._preset_names()

    def _save_preset(self):
        from tkinter.simpledialog import askstring
        name = askstring("Save Preset", "Preset name:", initialvalue=self.dungeon_var.get()
                         if self.dungeon_var.get() != "— select dungeon —" else "")
        if not name or not name.strip():
            return
        name = name.strip()
        try:
            p = self._read_params()
            self.dungeon_presets[name] = {
                "page_w":      p["width_in"],
                "page_h":      p["height_in"],
                "notes_in":    p["notes_bottom_in"],
                "dungeon_cols": p["dungeon_cols"],
                "dungeon_rows": p["dungeon_rows"],
                "start_col":   p["start_col"],
                "start_row":   p["start_row"],
            }
            save_dungeon_presets(self.dungeon_presets)
            self._refresh_preset_list()
            self.dungeon_var.set(name)
            self.status_var.set(f"Preset '{name}' saved.")
        except Exception as e:
            messagebox.showerror("Error", str(e))

    def _delete_preset(self):
        name = self.dungeon_var.get()
        if name == "— select dungeon —" or name not in self.dungeon_presets:
            return
        if not messagebox.askyesno("Delete preset", f"Delete '{name}'?"):
            return
        del self.dungeon_presets[name]
        save_dungeon_presets(self.dungeon_presets)
        self._refresh_preset_list()
        self.dungeon_var.set("— select dungeon —")
        self.status_var.set(f"Preset '{name}' deleted.")

    def _on_dungeon_preset(self, _=None):
        vals = self.dungeon_presets.get(self.dungeon_var.get())
        if not vals:
            return
        w    = vals["page_w"]
        h    = vals["page_h"]
        notes = vals["notes_in"]
        dcols = vals.get("dungeon_cols")
        drows = vals.get("dungeon_rows")
        sc    = vals.get("start_col")
        sr    = vals.get("start_row")
        self.width_var.set(str(w))
        self.height_var.set(str(h))
        self.notes_bottom_var.set(str(notes))
        self.notes_enabled_var.set(True)
        self._notes_entry.config(state="normal")
        self.dungeon_cols_var.set(str(dcols) if dcols else "")
        self.dungeon_rows_var.set(str(drows) if drows else "")
        self.start_col_var.set(str(sc) if sc else "")
        self.start_row_var.set(str(sr) if sr else "")
        self.grid_size_var.set(vals.get("grid_size", "1/4 inch"))
        self.preset_var.set("Custom")
        if "sheets_wide" in vals and "sheets_tall" in vals:
            self.sheets_wide_var.set(str(vals["sheets_wide"]))
            self.sheets_tall_var.set(str(vals["sheets_tall"]))
        else:
            self._auto_sheets()

    def _auto_sheets(self):
        """Compute sheets_wide/tall needed to fit the dungeon on the current page size."""
        try:
            width_in  = float(self.width_var.get())
            height_in = float(self.height_var.get())
            margin_in = float(self.margin_var.get())
            notes_in  = float(self.notes_bottom_var.get() or 0)
            grid_in    = GRID_SIZES[self.grid_size_var.get()]
            box_cells  = max(1, int(self.box_cells_var.get() or 4))
            box_in     = box_cells * grid_in
            dcols = int(self.dungeon_cols_var.get()) if self.dungeon_cols_var.get().strip() else None
            drows = int(self.dungeon_rows_var.get()) if self.dungeon_rows_var.get().strip() else None
            if not dcols or not drows:
                return
            dung_w = dcols * grid_in
            dung_h = drows * grid_in
            content_w = width_in  - 2 * margin_in
            content_h = height_in - 2 * margin_in
            # height budget: dungeon + title-block offset (1 box) + notes on last row
            sw = max(1, math.ceil(dung_w / content_w))
            st = max(1, math.ceil((dung_h + box_in + notes_in) / content_h))
            self.sheets_wide_var.set(str(sw))
            self.sheets_tall_var.set(str(st))
        except (ValueError, KeyError):
            pass

    def _on_format(self, _=None):
        base = os.path.splitext(self.output_var.get())[0]
        self.output_var.set(base + (".pdf" if self.format_var.get() == "PDF" else ".png"))

    def _on_canvas_resize(self, event):
        new = (event.width, event.height)
        if new != self._last_canvas_size:
            self._last_canvas_size = new
            self._schedule_preview(delay=300)

    def _browse(self):
        fmt = self.format_var.get()
        path = filedialog.asksaveasfilename(
            defaultextension=".pdf" if fmt == "PDF" else ".png",
            filetypes=([("PDF", "*.pdf"), ("PNG", "*.png"), ("All", "*.*")]
                       if fmt == "PDF" else
                       [("PNG", "*.png"), ("PDF", "*.pdf"), ("All", "*.*")]),
            initialfile=self.output_var.get(),
        )
        if path:
            self.output_var.set(path)

    def _read_params(self):
        dpi = int(self.dpi_var.get())
        width_in  = float(self.width_var.get())
        height_in = float(self.height_var.get())
        fs = self.font_size_var.get().strip()

        raw_lines = [v.get() for v in self.title_vars]
        title_lines = []
        for line in raw_lines:
            line = line.replace("{size}", f"{width_in:.4g}\u00d7{height_in:.4g} in")
            line = line.replace("{dpi}",  f"{dpi} DPI")
            title_lines.append(line)

        return {
            "width_in":         width_in,
            "height_in":        height_in,
            "dpi":              dpi,
            "margin_in":        float(self.margin_var.get()),
            "grid_size_in":     GRID_SIZES[self.grid_size_var.get()],
            "box_size_in":      max(1, int(self.box_cells_var.get() or 4)) * GRID_SIZES[self.grid_size_var.get()],
            "font_size":        int(fs) if fs else None,
            "line_color":       tuple(self._line_color),
            "heavy_color":      tuple(self._heavy_color),
            "index_color":      tuple(self._index_color),
            "line_thickness":   int(self.line_thickness_var.get()),
            "heavy_thickness":  int(self.heavy_thickness_var.get()),
            "dashed":           self.dashed_var.get(),
            "title_lines":      title_lines,
            "sheets_wide":      int(self.sheets_wide_var.get()),
            "sheets_tall":      int(self.sheets_tall_var.get()),
            "tab_in":           TAB_SIZES[self.tab_size_var.get()],
            "tab_style":        self.tab_style_var.get(),
            "notes_bottom_in":  float(self.notes_bottom_var.get() or 0) if self.notes_enabled_var.get() else 0.0,
            "start_col":    int(self.start_col_var.get())    if self.start_col_var.get().strip()    else None,
            "start_row":    int(self.start_row_var.get())    if self.start_row_var.get().strip()    else None,
            "dungeon_cols": int(self.dungeon_cols_var.get()) if self.dungeon_cols_var.get().strip() else None,
            "dungeon_rows": int(self.dungeon_rows_var.get()) if self.dungeon_rows_var.get().strip() else None,
        }

    def _fit(self, img, canvas_w, canvas_h):
        iw, ih = img.size
        scale = min((canvas_w - 4) / iw, (canvas_h - 4) / ih)
        return img.resize((max(1, int(iw * scale)), max(1, int(ih * scale))))

    # ── preview ───────────────────────────────────────────────────────────────
    def _schedule_preview(self, delay=600):
        self._preview_zoom = 1.0
        if self._preview_job:
            self.after_cancel(self._preview_job)
        self._preview_job = self.after(delay, self._run_preview)

    def _run_preview(self):
        self._preview_job = None
        self.preview_btn.config(state="disabled")
        self.status_var.set("Updating preview…")
        canvas_w, canvas_h = self._canvas_size()
        threading.Thread(target=self._preview_worker, args=(canvas_w, canvas_h), daemon=True).start()

    def _preview_worker(self, canvas_w, canvas_h):
        try:
            params = self._read_params()
            longest = max(params["width_in"], params["height_in"])
            preview_dpi = min(params["dpi"], max(72, int(PREVIEW_MAX_PX / longest)))

            sw, st = params["sheets_wide"], params["sheets_tall"]

            if sw == 1 and st == 1:
                img = generate_graph_paper(dpi=preview_dpi, **{k: v for k, v in params.items()
                                           if k not in ("dpi", "sheets_wide", "sheets_tall")},
                                           sheets_wide=1, sheets_tall=1)
                thumb = self._fit(img, canvas_w, canvas_h)
            else:
                # tile all sheets as a composite preview
                thumb = self._tiled_preview(params, preview_dpi, canvas_w, canvas_h)

            self.after(0, self._show_preview, thumb, canvas_w, canvas_h)
        except Exception as e:
            self.after(0, self._preview_error, str(e), canvas_w, canvas_h)

    def _tiled_preview(self, params, preview_dpi, canvas_w, canvas_h):
        sw, st = params["sheets_wide"], params["sheets_tall"]
        border = 4  # px gap between tiles

        kw = {k: v for k, v in params.items() if k != "dpi"}

        # generate all sheets at preview dpi
        sheets = {}
        for row in range(st):
            for col in range(sw):
                img = generate_graph_paper(dpi=preview_dpi, sheet_col=col, sheet_row=row, **kw)
                sheets[(col, row)] = img

        # tile into one image
        sw_px = sheets[(0,0)].width
        sh_px = sheets[(0,0)].height
        composite_w = sw * sw_px + (sw - 1) * border
        composite_h = st * sh_px + (st - 1) * border
        composite = Image.new("RGB", (composite_w, composite_h), "#ccc")
        for (col, row), img in sheets.items():
            composite.paste(img, (col * (sw_px + border), row * (sh_px + border)))

        return self._fit(composite, canvas_w, canvas_h)

    def _show_preview(self, img, canvas_w, canvas_h):
        self._preview_base = img
        self._preview_zoom = 1.0
        self._apply_zoom()
        self.preview_btn.config(state="normal")
        self.status_var.set("Ready.")

    def _apply_zoom(self):
        if self._preview_base is None:
            return
        img = self._preview_base
        if self._preview_zoom != 1.0:
            nw = max(1, int(img.width  * self._preview_zoom))
            nh = max(1, int(img.height * self._preview_zoom))
            img = img.resize((nw, nh), Image.LANCZOS)
        photo = ImageTk.PhotoImage(img)
        self._preview_photo = photo
        self.canvas.delete("all")
        self.canvas.config(scrollregion=(0, 0, img.width, img.height))
        self.canvas.create_image(img.width // 2, img.height // 2, anchor="center", image=photo)

    def _on_scroll(self, event):
        if event.num == 4 or (hasattr(event, "delta") and event.delta > 0):
            self._preview_zoom = min(8.0, self._preview_zoom * 1.15)
        else:
            self._preview_zoom = max(0.2, self._preview_zoom / 1.15)
        self._apply_zoom()

    def _preview_error(self, msg, canvas_w, canvas_h):
        self.canvas.delete("all")
        self.canvas.create_text(canvas_w // 2, canvas_h // 2,
                                text=f"Preview error:\n{msg}", fill="red",
                                width=canvas_w - 20, justify="center")
        self.preview_btn.config(state="normal")
        self.status_var.set("Ready.")

    # ── generate & save ───────────────────────────────────────────────────────
    def _generate(self):
        self.gen_btn.config(state="disabled")
        self.status_var.set("Generating…")
        canvas_w, canvas_h = self._canvas_size()
        threading.Thread(target=self._generate_worker, args=(canvas_w, canvas_h), daemon=True).start()

    def _generate_worker(self, canvas_w, canvas_h):
        try:
            params  = self._read_params()
            output  = self.output_var.get()
            sw, st  = params["sheets_wide"], params["sheets_tall"]
            is_pdf  = output.lower().endswith(".pdf")
            dpi     = params["dpi"]
            kw      = {k: v for k, v in params.items()
                       if k not in ("dpi", "sheets_wide", "sheets_tall")}

            if sw == 1 and st == 1:
                img = generate_graph_paper(dpi=dpi, sheets_wide=sw, sheets_tall=st, **kw)
                saved = [output]
                if is_pdf:
                    img.save(output, "PDF", resolution=dpi)
                else:
                    img.save(output)
                thumb_img = img
            else:
                sheets = generate_all_sheets(sw, st, dpi=dpi, **kw)
                images = [img for _, _, img in sheets]

                if is_pdf:
                    images[0].save(output, "PDF", resolution=dpi,
                                   save_all=True, append_images=images[1:])
                    saved = [output]
                else:
                    base, ext = os.path.splitext(output)
                    saved = []
                    for col, row, img in sheets:
                        from generate_graph_paper import index_label_from_num
                        fn = f"{base}_{index_label_from_num(col)}{row+1}{ext}"
                        img.save(fn)
                        saved.append(fn)

                # composite thumb
                sw_px = images[0].width
                sh_px = images[0].height
                border = 4
                composite_w = sw * sw_px + (sw-1)*border
                composite_h = st * sh_px + (st-1)*border
                composite = Image.new("RGB", (composite_w, composite_h), "#ccc")
                for col, row, img in sheets:
                    composite.paste(img, (col*(sw_px+border), row*(sh_px+border)))
                thumb_img = composite

            thumb = self._fit(thumb_img, canvas_w, canvas_h)
            self.after(0, self._generate_done, saved, thumb, canvas_w, canvas_h)
        except Exception as e:
            self.after(0, self._error, str(e))

    def _generate_done(self, saved, thumb, canvas_w, canvas_h):
        self._show_preview(thumb, canvas_w, canvas_h)
        if len(saved) == 1:
            msg = f"Saved: {os.path.abspath(saved[0])}"
        else:
            msg = f"Saved {len(saved)} sheets:\n" + "\n".join(os.path.basename(p) for p in saved)
        self.status_var.set(msg.split("\n")[0])
        self.gen_btn.config(state="normal")
        messagebox.showinfo("Done", msg)

    def _error(self, msg):
        self.status_var.set(f"Error: {msg}")
        self.gen_btn.config(state="normal")
        messagebox.showerror("Error", msg)

    def _print(self):
        import tempfile
        import platform
        self.print_btn.config(state="disabled")
        self.status_var.set("Generating for print…")
        is_win = platform.system() == "Windows"
        def worker():
            try:
                params = self._read_params()
                dpi    = params["dpi"]
                sw, st = params["sheets_wide"], params["sheets_tall"]
                kw     = {k: v for k, v in params.items()
                          if k not in ("dpi", "sheets_wide", "sheets_tall")}
                if sw == 1 and st == 1:
                    img = generate_graph_paper(dpi=dpi, sheets_wide=1, sheets_tall=1, **kw)
                    if is_win:
                        with tempfile.NamedTemporaryFile(delete=False, suffix=".png") as f:
                            tmp = f.name
                        img.save(tmp, "PNG")
                        self.after(0, self._do_print, [tmp])
                    else:
                        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as f:
                            tmp = f.name
                        img.save(tmp, "PDF", resolution=dpi)
                        self.after(0, self._do_print, [tmp])
                else:
                    sheets = generate_all_sheets(sw, st, dpi=dpi, **kw)
                    if is_win:
                        paths = []
                        for col, row, img in sheets:
                            with tempfile.NamedTemporaryFile(delete=False, suffix=".png") as f:
                                paths.append(f.name)
                            img.save(paths[-1], "PNG")
                        self.after(0, self._do_print, paths)
                    else:
                        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as f:
                            tmp = f.name
                        images = [img for _, _, img in sheets]
                        images[0].save(tmp, "PDF", resolution=dpi,
                                       save_all=True, append_images=images[1:])
                        self.after(0, self._do_print, [tmp])
            except Exception as e:
                self.after(0, self._error_print, str(e))
        threading.Thread(target=worker, daemon=True).start()

    def _do_print(self, paths):
        import subprocess
        import platform
        self.print_btn.config(state="normal")
        self.status_var.set("Ready.")
        try:
            sys = platform.system()
            for path in paths:
                if sys == "Windows":
                    os.startfile(os.path.abspath(path), "print")
                elif sys == "Darwin":
                    subprocess.run(["lpr", path])
                else:
                    subprocess.run(["lp", path])
        except Exception as e:
            messagebox.showerror("Print error", str(e))

    def _error_print(self, msg):
        self.print_btn.config(state="normal")
        self.status_var.set(f"Error: {msg}")
        messagebox.showerror("Print error", msg)


if __name__ == "__main__":
    App().mainloop()
