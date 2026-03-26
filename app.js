// ── Constants ────────────────────────────────────────────────────────────────
const PAGE_PRESETS = {
  'Letter (8.5×11)':            [8.5,   11,    1.5],
  'Letter Landscape (11×8.5)':  [11,    8.5,   1.0],
  '── DesignJet T125 ──':       null,
  'T125 — 24×36':               [24,    36,    2.0],
  'T125 — 24×48':               [24,    48,    2.0],
  'T125 — 24×60':               [24,    60,    2.5],
  '── Other ──':                null,
  'Tabloid (11×17)':            [11,    17,    1.5],
  'Tabloid Landscape (17×11)':  [17,    11,    1.5],
  'A4 (8.27×11.69)':            [8.27,  11.69, 1.5],
  'A3 (11.69×16.54)':           [11.69, 16.54, 1.5],
  'Custom':                     null,
};

// Embedded fallback — matches dungeon_presets.json exactly
const BUILTIN_PRESETS = {
  "D1  (\u226226\u00d726) \u00b7 Letter":                    {"page_w":8.5,"page_h":11, "notes_in":1.5,"dungeon_cols":26, "dungeon_rows":26, "start_col":2,   "start_row":11},
  "D2  (\u226226\u00d726) \u00b7 Letter":                    {"page_w":8.5,"page_h":11, "notes_in":1.5,"dungeon_cols":26, "dungeon_rows":26, "start_col":21,  "start_row":15},
  "D3  (\u226226\u00d726) \u00b7 Letter":                    {"page_w":8.5,"page_h":11, "notes_in":1.5,"dungeon_cols":26, "dungeon_rows":26, "start_col":23,  "start_row":23},
  "D4  (\u226226\u00d726) \u00b7 Letter":                    {"page_w":8.5,"page_h":11, "notes_in":1.5,"dungeon_cols":26, "dungeon_rows":26, "start_col":3,   "start_row":7},
  "D5  (\u226226\u00d726) \u00b7 Letter":                    {"page_w":8.5,"page_h":11, "notes_in":1.5,"dungeon_cols":26, "dungeon_rows":26, "start_col":1,   "start_row":26},
  "D6\u20138  (\u226226\u00d726) \u00b7 Letter":             {"page_w":8.5,"page_h":11, "notes_in":1.5,"dungeon_cols":26, "dungeon_rows":26, "start_col":null,"start_row":null},
  "D9\u201314 (\u226240\u00d730) \u00b7 Letter landscape":   {"page_w":11, "page_h":8.5,"notes_in":1.5,"dungeon_cols":40, "dungeon_rows":30, "start_col":null,"start_row":null,"grid_size":"3/16 inch","sheets_wide":1,"sheets_tall":1},
  "D15\u201318 (\u226262\u00d748) \u00b7 Letter":            {"page_w":8.5,"page_h":11, "notes_in":1.0,"dungeon_cols":62, "dungeon_rows":48, "start_col":null,"start_row":null,"grid_size":"3/16 inch","sheets_wide":2,"sheets_tall":2},
  "D15\u201318 (\u226262\u00d748) \u00b7 T125":              {"page_w":16, "page_h":13, "notes_in":2.0,"dungeon_cols":62, "dungeon_rows":48, "start_col":null,"start_row":null,"grid_size":"3/16 inch"},
  "D19\u201320 (\u226284\u00d7110) \u00b7 Letter":           {"page_w":8.5,"page_h":11, "notes_in":0.5,"dungeon_cols":84, "dungeon_rows":110,"start_col":null,"start_row":null},
  "D19\u201320 (\u226284\u00d7110) \u00b7 T125":             {"page_w":22, "page_h":28, "notes_in":2.0,"dungeon_cols":84, "dungeon_rows":110,"start_col":null,"start_row":null},
  "D21   (\u2248115\u00d7115) \u00b7 Letter":                {"page_w":8.5,"page_h":11, "notes_in":0.5,"dungeon_cols":115,"dungeon_rows":115,"start_col":null,"start_row":null},
  "D21   (\u2248115\u00d7115) \u00b7 T125":                  {"page_w":24, "page_h":30, "notes_in":1.0,"dungeon_cols":115,"dungeon_rows":115,"start_col":null,"start_row":null},
  "D22   (\u2248107\u00d7114) \u00b7 Letter":                {"page_w":8.5,"page_h":11, "notes_in":0.5,"dungeon_cols":107,"dungeon_rows":114,"start_col":null,"start_row":null},
  "D22   (\u2248107\u00d7114) \u00b7 T125":                  {"page_w":24, "page_h":30, "notes_in":1.0,"dungeon_cols":107,"dungeon_rows":114,"start_col":null,"start_row":null},
};

let dungeonPresets = {};
let previewScheduled = false;
let previewCol = null, previewRow = null;

// ── Drawing constants ────────────────────────────────────────────────────────
/* eslint-disable no-magic-numbers */
const DEFAULTS = {
  WIDTH_IN: 8.5, HEIGHT_IN: 11, DPI: 150,
  LINE_COLOR:  [173, 216, 230],
  HEAVY_COLOR: [173, 216, 230],
  INDEX_COLOR: [40, 60, 120],
  LABEL_COLOR: [220, 220, 220],
  LINE_THICKNESS: 1, HEAVY_THICKNESS: 2,
  MARGIN_IN: 0.25, GRID_SIZE_IN: 0.25, BOX_CELLS: 4, TAB_IN: 0.25,
};

const RATIOS = {
  DASH_LEN: 0.045,         // dash length relative to DPI
  AUTO_FONT: 0.18,          // font size relative to box
  TITLE_FONT: 0.22,         // title font relative to box
  LABEL_FONT_MIN: 6,        // minimum label font size px
  PAD_INNER_DIV: 12,        // inner padding = boxPx / this
  LINE_GAP_DIV: 20,         // line gap = boxPx / this
  DASH_MIN: 4,              // minimum dash length px
  ROUND_CORNER_DIV: 8,      // corner radius = boxPx / this
  SLOT_FONT_SCALE: 1.2,     // slot label font multiplier
  DUNGEON_LABEL_OFFSET: 0.5,// label offset in grid units
};

const CUT_COLOR  = [200, 40, 40];
const SLOT_COLOR = [40, 120, 40];
const TAB_FILL   = 'rgba(30, 140, 30, 0.08)';
const SLOT_FILL  = 'rgba(200, 40, 40, 0.06)';
const TAB_SHADE  = 'rgba(173, 216, 230, 0.18)';
const NOTES_COLOR = [60, 60, 60];

// Character code constants
const CHAR_CODE_A = 65;
const ALPHABET_SIZE = 26;
const HEX_SLICE_1 = 1;
const HEX_SLICE_2 = 3;
const HEX_SLICE_3 = 5;
const HEX_SLICE_4 = 7;
const HEX_BASE = 16;
/* eslint-enable no-magic-numbers */

// ── Helpers ──────────────────────────────────────────────────────────────────
function indexLabelFromNum(n) {
  let s = '';
  do {
    s = String.fromCharCode(CHAR_CODE_A + (n % ALPHABET_SIZE)) + s;
    n = Math.floor(n / ALPHABET_SIZE) - 1;
  } while (n >= 0);
  return s;
}

function hexToRgb(hex) {
  return [
    parseInt(hex.slice(HEX_SLICE_1, HEX_SLICE_2), HEX_BASE),
    parseInt(hex.slice(HEX_SLICE_2, HEX_SLICE_3), HEX_BASE),
    parseInt(hex.slice(HEX_SLICE_3, HEX_SLICE_4), HEX_BASE),
  ];
}

function cssRgb(rgb) { return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`; }

function roundRectPath(ctx, x, y, w, h, r) {
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
}

// ── Core renderer ─────────────────────────────────────────────────────────────
function generateGraphPaper(canvas, p) {
  const {
    widthIn  = DEFAULTS.WIDTH_IN,
    heightIn = DEFAULTS.HEIGHT_IN,
    dpi      = DEFAULTS.DPI,
    lineColor     = DEFAULTS.LINE_COLOR,
    heavyColor    = DEFAULTS.HEAVY_COLOR,
    indexColor    = DEFAULTS.INDEX_COLOR,
    lineThickness = DEFAULTS.LINE_THICKNESS,
    heavyThickness = DEFAULTS.HEAVY_THICKNESS,
    marginIn  = DEFAULTS.MARGIN_IN,
    gridSizeIn = DEFAULTS.GRID_SIZE_IN,
    boxCells  = DEFAULTS.BOX_CELLS,
    fontSize  = null, dashed = true, titleLines = null,
    sheetCol = 0, sheetRow = 0, sheetsWide = 1, sheetsTall = 1,
    tabIn = DEFAULTS.TAB_IN,
    notesBottomIn = 0, startCol = null, startRow = null,
    dungeonCols = null, dungeonRows = null,
    tabStyle = 'tape',
  } = p;

  const widthPx  = Math.round(widthIn  * dpi);
  const heightPx = Math.round(heightIn * dpi);
  const marginPx = Math.round(marginIn * dpi);
  const gridPx   = Math.max(1, Math.round(gridSizeIn * dpi));
  const gridPerBox = Math.max(1, boxCells);
  const boxPx    = gridPx * gridPerBox;
  const tabPx    = (sheetsWide > 1 || sheetsTall > 1) ? Math.round(tabIn * dpi) : 0;
  const notesPx  = (sheetRow === sheetsTall - 1) ? Math.round(notesBottomIn * dpi) : 0;
  const dashLen  = Math.max(RATIOS.DASH_MIN, Math.round(dpi * RATIOS.DASH_LEN));

  const autoFontSize  = fontSize || Math.max(1, Math.round(boxPx * RATIOS.AUTO_FONT));
  const labelFontSize = Math.max(RATIOS.LABEL_FONT_MIN, Math.floor(gridPx / 2));
  const labelColor    = DEFAULTS.LABEL_COLOR;
  const padInner      = Math.max(2, Math.round(boxPx / RATIOS.PAD_INNER_DIV));
  const lineGap       = Math.max(1, Math.round(boxPx / RATIOS.LINE_GAP_DIV));
  const nLines        = Math.max(1, (titleLines||[]).length);
  const maxTf         = Math.max(1, Math.round((boxPx - padInner) / nLines) - lineGap);
  const titleFontSize = Math.min(Math.max(1, Math.round(boxPx * 0.22)), maxTf);

  const usableWPx  = widthPx  - 2 * marginPx;
  const usableHPx  = heightPx - 2 * marginPx - notesPx;
  const contentWPx = Math.max(1, usableWPx - tabPx);
  const contentHPx = Math.max(1, usableHPx - tabPx);
  const xAbsBase   = sheetCol * contentWPx;
  const yAbsBase   = sheetRow * contentHPx;
  const xPhase     = xAbsBase % gridPx;
  const yPhase     = yAbsBase % gridPx;
  const gridX0     = marginPx + (gridPx - xPhase) % gridPx;
  const gridY0     = marginPx + (gridPx - yPhase) % gridPx;
  const gridBottom = heightPx - marginPx - notesPx;

  canvas.width  = widthPx;
  canvas.height = heightPx;
  const ctx = canvas.getContext('2d');

  // background
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, widthPx, heightPx);

  // helper: evenly-spaced tab positions along a seam
  function seamTabs(seamTop, seamBot) {
    const seamLen   = seamBot - seamTop;
    const period    = Math.max(gridPx * 4, Math.round(boxPx * 1.2));
    const nPeriods  = Math.max(2, Math.round(seamLen / period));
    const actPeriod = seamLen / nPeriods;
    const tabH      = Math.round(actPeriod * 0.5);
    const tabs = [];
    for (let i = 0; i < nPeriods; i++) {
      const gapTop = seamTop + i * actPeriod;
      const tabTop = gapTop + Math.round((actPeriod - tabH) / 2);
      tabs.push({ gapTop, tabTop, tabBot: tabTop + tabH, gapBot: gapTop + actPeriod });
    }
    return tabs;
  }

  // tab shading — left/top strip on sheets that go under neighbours
  if (tabPx > 0) {
    if (sheetCol > 0) {
      if (tabStyle === 'tape') {
        ctx.fillStyle = 'rgb(210,230,255)';
        ctx.fillRect(marginPx, marginPx, tabPx, gridBottom - marginPx);
      } else {
        const seamTop = sheetRow > 0 ? marginPx + tabPx : marginPx;
        ctx.fillStyle = 'rgb(210,230,255)';
        for (const { gapTop, tabTop, tabBot, gapBot } of seamTabs(seamTop, gridBottom)) {
          if (Math.round(tabTop) > Math.round(gapTop))
            ctx.fillRect(marginPx, Math.round(gapTop), tabPx, Math.round(tabTop) - Math.round(gapTop));
          if (Math.round(gapBot) > Math.round(tabBot))
            ctx.fillRect(marginPx, Math.round(tabBot), tabPx, Math.round(gapBot) - Math.round(tabBot));
        }
      }
    }
    if (sheetRow > 0) {
      if (tabStyle === 'tape') {
        ctx.fillStyle = 'rgb(210,230,255)';
        ctx.fillRect(marginPx, marginPx, widthPx - 2*marginPx, tabPx);
      } else {
        const seamLeft = sheetCol > 0 ? marginPx + tabPx : marginPx;
        ctx.fillStyle = 'rgb(210,230,255)';
        for (const { gapTop: gL, tabTop: tL, tabBot: tR, gapBot: gR } of seamTabs(seamLeft, widthPx - marginPx)) {
          if (Math.round(tL) > Math.round(gL))
            ctx.fillRect(Math.round(gL), marginPx, Math.round(tL) - Math.round(gL), tabPx);
          if (Math.round(gR) > Math.round(tR))
            ctx.fillRect(Math.round(tR), marginPx, Math.round(gR) - Math.round(tR), tabPx);
        }
      }
    }
    // insert mode: shade slot zone on mating edges
    if (tabStyle === 'insert') {
      ctx.fillStyle = 'rgb(220,255,220)';
      if (sheetCol < sheetsWide - 1) ctx.fillRect(widthPx - marginPx - tabPx, marginPx, tabPx, gridBottom - marginPx);
      if (sheetRow < sheetsTall - 1) ctx.fillRect(marginPx, gridBottom - tabPx, widthPx - 2*marginPx, tabPx);
    }
  }

  // grid lines
  for (let x = gridX0; x <= widthPx - marginPx; x += gridPx) {
    const absX    = (x - marginPx) + xAbsBase;
    const isHeavy = Math.floor(absX / gridPx) % gridPerBox === 0;
    ctx.strokeStyle = cssRgb(isHeavy ? heavyColor : lineColor);
    ctx.lineWidth   = isHeavy ? heavyThickness : lineThickness;
    ctx.setLineDash(dashed ? [dashLen, dashLen] : []);
    ctx.beginPath(); ctx.moveTo(x, marginPx); ctx.lineTo(x, gridBottom); ctx.stroke();
  }
  for (let y = gridY0; y <= gridBottom; y += gridPx) {
    const absY    = (y - marginPx) + yAbsBase;
    const isHeavy = Math.floor(absY / gridPx) % gridPerBox === 0;
    ctx.strokeStyle = cssRgb(isHeavy ? heavyColor : lineColor);
    ctx.lineWidth   = isHeavy ? heavyThickness : lineThickness;
    ctx.setLineDash(dashed ? [dashLen, dashLen] : []);
    ctx.beginPath(); ctx.moveTo(marginPx, y); ctx.lineTo(widthPx - marginPx, y); ctx.stroke();
  }
  ctx.setLineDash([]);

  // ── cut / insert guides ───────────────────────────────────────────────────
  if (tabPx > 0) {
    const cutCol  = cssRgb([200, 40, 40]);
    const slotCol = cssRgb([30, 140, 30]);
    const cutW    = Math.max(1, heavyThickness);
    const gDash   = Math.max(4, Math.round(dpi / 15));

    if (tabStyle === 'tape') {
      if (sheetCol > 0) {
        const cx = marginPx + tabPx;
        ctx.strokeStyle = cutCol; ctx.lineWidth = cutW;
        ctx.setLineDash([gDash, gDash]);
        ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, heightPx); ctx.stroke();
        ctx.setLineDash([]);
        ctx.save();
        ctx.translate(marginPx + tabPx / 2, heightPx / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillStyle = cutCol; ctx.font = `${autoFontSize}px monospace`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('CUT / TAPE UNDER', 0, 0);
        ctx.restore();
      }
      if (sheetRow > 0) {
        const cy = marginPx + tabPx;
        ctx.strokeStyle = cutCol; ctx.lineWidth = cutW;
        ctx.setLineDash([gDash, gDash]);
        ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(widthPx, cy); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = cutCol; ctx.font = `${autoFontSize}px monospace`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('CUT / TAPE UNDER', widthPx / 2, marginPx + tabPx / 2);
      }

    } else {
      // LEFT edge: comb cut guide
      if (sheetCol > 0) {
        const cx       = marginPx + tabPx;
        const seamTop  = sheetRow > 0 ? marginPx + tabPx : marginPx;
        const tabs     = seamTabs(seamTop, gridBottom);
        ctx.strokeStyle = cutCol; ctx.lineWidth = cutW;
        for (const { gapTop, tabTop, tabBot, gapBot } of tabs) {
          ctx.setLineDash([gDash, gDash]);
          ctx.beginPath(); ctx.moveTo(cx, gapTop); ctx.lineTo(cx, tabTop); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(cx, tabBot);  ctx.lineTo(cx, gapBot);  ctx.stroke();
          ctx.beginPath(); ctx.moveTo(marginPx, tabTop); ctx.lineTo(cx, tabTop); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(marginPx, tabBot); ctx.lineTo(cx, tabBot); ctx.stroke();
        }
        ctx.setLineDash([]);
        ctx.save();
        ctx.translate(marginPx + tabPx / 2, heightPx / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillStyle = cutCol; ctx.font = `${autoFontSize}px monospace`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('CUT TABS / INSERT', 0, 0);
        ctx.restore();
      }

      // TOP edge: comb cut guide
      if (sheetRow > 0) {
        const cy      = marginPx + tabPx;
        const seamLeft = sheetCol > 0 ? marginPx + tabPx : marginPx;
        const tabs    = seamTabs(seamLeft, widthPx - marginPx);
        ctx.strokeStyle = cutCol; ctx.lineWidth = cutW;
        for (const { gapTop: gapL, tabTop: tabL, tabBot: tabR, gapBot: gapR } of tabs) {
          ctx.setLineDash([gDash, gDash]);
          ctx.beginPath(); ctx.moveTo(gapL, cy); ctx.lineTo(tabL, cy); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(tabR, cy); ctx.lineTo(gapR, cy); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(tabL, marginPx); ctx.lineTo(tabL, cy); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(tabR, marginPx); ctx.lineTo(tabR, cy); ctx.stroke();
        }
        ctx.setLineDash([]);
        ctx.fillStyle = cutCol; ctx.font = `${autoFontSize}px monospace`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('CUT TABS / INSERT', widthPx / 2, marginPx + tabPx / 2);
      }

      // RIGHT edge: slot marks
      if (sheetCol < sheetsWide - 1) {
        const slotX0  = widthPx - marginPx - tabPx;
        const slotX1  = widthPx - marginPx;
        const seamTop = sheetRow > 0 ? marginPx + tabPx : marginPx;
        const tabs    = seamTabs(seamTop, gridBottom);
        ctx.strokeStyle = slotCol; ctx.lineWidth = cutW;
        ctx.setLineDash([gDash, gDash]);
        for (const { tabTop, tabBot } of tabs) {
          ctx.beginPath(); ctx.moveTo(slotX0, tabTop); ctx.lineTo(slotX1, tabTop); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(slotX0, tabBot); ctx.lineTo(slotX1, tabBot); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(slotX0, tabTop); ctx.lineTo(slotX0, tabBot); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(slotX1, tabTop); ctx.lineTo(slotX1, tabBot); ctx.stroke();
        }
        ctx.setLineDash([]);
        ctx.save();
        ctx.translate(slotX0 + tabPx / 2, gridBottom / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillStyle = slotCol; ctx.font = `${autoFontSize}px monospace`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('CUT SLOTS', 0, 0);
        ctx.restore();
      }

      // BOTTOM edge: slot marks
      if (sheetRow < sheetsTall - 1) {
        const slotY0  = gridBottom - tabPx;
        const slotY1  = gridBottom;
        const seamLeft = sheetCol > 0 ? marginPx + tabPx : marginPx;
        const tabs    = seamTabs(seamLeft, widthPx - marginPx);
        ctx.strokeStyle = slotCol; ctx.lineWidth = cutW;
        ctx.setLineDash([gDash, gDash]);
        for (const { tabTop: tabL, tabBot: tabR } of tabs) {
          ctx.beginPath(); ctx.moveTo(tabL, slotY0); ctx.lineTo(tabR, slotY0); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(tabL, slotY1); ctx.lineTo(tabR, slotY1); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(tabL, slotY0); ctx.lineTo(tabL, slotY1); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(tabR, slotY0); ctx.lineTo(tabR, slotY1); ctx.stroke();
        }
        ctx.setLineDash([]);
        ctx.fillStyle = slotCol; ctx.font = `${autoFontSize}px monospace`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('CUT SLOTS', widthPx / 2, slotY0 + tabPx / 2);
      }
    }
  }

  // index labels
  ctx.font = `${labelFontSize}px monospace`;
  ctx.fillStyle = cssRgb(labelColor);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const labelCy = marginPx / 2, labelCx = marginPx / 2;
  for (let x = gridX0; x <= widthPx - marginPx; x += gridPx) {
    const absX = (x - marginPx) + xAbsBase;
    if (Math.floor(absX / gridPx) % gridPerBox === 0)
      ctx.fillText(indexLabelFromNum(Math.floor(absX / gridPx)), x + gridPx / 2, labelCy);
  }
  for (let y = gridY0; y <= gridBottom; y += gridPx) {
    const absY = (y - marginPx) + yAbsBase;
    if (Math.floor(absY / gridPx) % gridPerBox === 0)
      ctx.fillText(String(Math.floor(absY / gridPx) + 1), labelCx, y + gridPx / 2);
  }

  // title block (sheet 0,0 only)
  if (sheetCol === 0 && sheetRow === 0 && titleLines) {
    const blockW = boxPx * 2, blockH = boxPx;
    const radius = Math.max(2, Math.round(boxPx / 8));
    ctx.strokeStyle = 'black'; ctx.lineWidth = Math.max(1, heavyThickness); ctx.setLineDash([]);
    ctx.beginPath(); roundRectPath(ctx, marginPx, marginPx, blockW, blockH, radius); ctx.stroke();

    const active = titleLines.filter(l => l.trim());
    const nActive = Math.max(1, active.length);
    const totalH = nActive * titleFontSize + (nActive - 1) * lineGap;
    let textY = marginPx + (blockH - totalH) / 2;
    ctx.fillStyle = 'black'; ctx.font = `${titleFontSize}px monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const line of active) {
      ctx.fillText(line, marginPx + blockW / 2, textY + titleFontSize / 2);
      textY += titleFontSize + lineGap;
    }
  }

  // sheet label
  if (sheetsWide > 1 || sheetsTall > 1) {
    ctx.fillStyle = 'rgb(220,220,220)';
    ctx.font = `${autoFontSize}px monospace`;
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(`Sheet ${indexLabelFromNum(sheetCol)}${sheetRow + 1}`,
                 widthPx - marginPx - boxPx, heightPx - marginPx - 2);
  }

  // dungeon border + labels
  let dungXOff = 0, dungYOff = 0;
  const dungOriginY = boxPx;

  if (dungeonCols && dungeonRows) {
    const totalW = sheetsWide * contentWPx;
    const totalH = sheetsTall * contentHPx - dungOriginY;
    const dungW  = dungeonCols * gridPx, dungH = dungeonRows * gridPx;
    dungXOff = Math.floor(Math.max(0, (totalW - dungW) / 2) / gridPx) * gridPx;
    dungYOff = Math.floor(Math.max(0, (totalH - dungH) / 2) / gridPx) * gridPx;

    const lx = marginPx + dungXOff - xAbsBase;
    const ty = marginPx + dungOriginY + dungYOff - yAbsBase;
    const rx = lx + dungW, by = ty + dungH;
    const sx0 = marginPx, sy0 = marginPx, sx1 = widthPx - marginPx, sy1 = gridBottom;

    ctx.strokeStyle = cssRgb([60, 60, 60]);
    ctx.lineWidth = Math.max(2, heavyThickness + 1); ctx.setLineDash([]);

    function hline(yy, x0, x1) {
      const cx0 = Math.max(x0, sx0), cx1 = Math.min(x1, sx1);
      if (cx0 < cx1) { ctx.beginPath(); ctx.moveTo(cx0, yy); ctx.lineTo(cx1, yy); ctx.stroke(); }
    }
    function vline(xx, y0, y1) {
      const cy0 = Math.max(y0, sy0), cy1 = Math.min(y1, sy1);
      if (cy0 < cy1) { ctx.beginPath(); ctx.moveTo(xx, cy0); ctx.lineTo(xx, cy1); ctx.stroke(); }
    }

    if (sy0 <= ty && ty <= sy1) hline(ty, lx, rx);
    if (sy0 <= by && by <= sy1) hline(by, lx, rx);
    if (sx0 <= lx && lx <= sx1) vline(lx, ty, by);
    if (sx0 <= rx && rx <= sx1) vline(rx, ty, by);

    // dungeon-relative labels
    ctx.fillStyle = cssRgb(indexColor);
    ctx.font = `${labelFontSize}px monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (sy0 <= ty && ty <= sy1 && ty - gridPx/2 >= 0) {
      for (let x = lx; x < rx; x += gridPx) {
        const mx = x + gridPx / 2;
        if (sx0 <= mx && mx <= sx1)
          ctx.fillText(indexLabelFromNum(Math.round((x - lx) / gridPx)), mx, ty - gridPx / 2);
      }
    }
    if (sx0 <= lx && lx <= sx1 && lx - gridPx/2 >= 0) {
      for (let y = ty; y < by; y += gridPx) {
        const my = y + gridPx / 2;
        if (sy0 <= my && my <= sy1)
          ctx.fillText(String(Math.round((y - ty) / gridPx) + 1), lx - gridPx / 2, my);
      }
    }
  }

  // start marker
  if (startCol != null && startRow != null && dungeonCols && dungeonRows) {
    const absSx  = dungXOff + (startCol - 1) * gridPx;
    const absSy  = dungYOff + (startRow  - 1) * gridPx;
    const localSx = marginPx + (absSx - xAbsBase);
    const localSy = marginPx + dungOriginY + (absSy - yAbsBase);
    if (marginPx <= localSx && localSx < widthPx - marginPx &&
        marginPx <= localSy && localSy < gridBottom) {
      ctx.fillStyle = 'rgb(255,255,180)';
      ctx.fillRect(localSx, localSy, gridPx, gridPx);
      ctx.fillStyle = 'rgb(180,120,0)';
      ctx.font = `${autoFontSize}px monospace`;
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText('S', localSx + 2, localSy + 1);
    }
  }

  // notes area
  if (notesPx > 0) {
    const rulePx = Math.max(gridPx, Math.round(0.25 * dpi));
    ctx.strokeStyle = 'black'; ctx.lineWidth = Math.max(1, heavyThickness); ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(marginPx, gridBottom); ctx.lineTo(widthPx - marginPx, gridBottom); ctx.stroke();
    ctx.fillStyle = cssRgb(indexColor);
    ctx.font = `${autoFontSize}px monospace`;
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText('Notes', marginPx + (sheetCol > 0 ? tabPx : 0) + padInner, gridBottom + padInner);
    ctx.strokeStyle = cssRgb(lineColor); ctx.lineWidth = lineThickness; ctx.setLineDash([]);
    for (let y = gridBottom + rulePx; y <= heightPx - marginPx; y += rulePx) {
      ctx.beginPath(); ctx.moveTo(marginPx, y); ctx.lineTo(widthPx - marginPx, y); ctx.stroke();
    }
  }
}

// ── Read params ───────────────────────────────────────────────────────────────
function readParams(dpiOverride) {
  const notesEnabled = document.getElementById('notes-enabled').checked;
  const fsRaw = document.getElementById('font-size').value.trim();
  return {
    widthIn:       parseFloat(document.getElementById('width').value)          || 8.5,
    heightIn:      parseFloat(document.getElementById('height').value)         || 11,
    dpi:           dpiOverride || parseInt(document.getElementById('dpi').value) || 150,
    marginIn:      parseFloat(document.getElementById('margin').value)         || 0.25,
    gridSizeIn:    parseFloat(document.getElementById('grid-size').value)      || 0.25,
    boxCells:      parseInt(document.getElementById('box-cells').value)        || 4,
    lineThickness: parseInt(document.getElementById('line-thickness').value)   || 1,
    heavyThickness:parseInt(document.getElementById('heavy-thickness').value)  || 2,
    dashed:        document.getElementById('dashed').checked,
    lineColor:     hexToRgb(document.getElementById('line-color').value),
    heavyColor:    hexToRgb(document.getElementById('heavy-color').value),
    indexColor:    hexToRgb(document.getElementById('index-color').value),
    titleLines: [
      document.getElementById('title1').value,
      document.getElementById('title2').value,
      document.getElementById('title3').value,
      document.getElementById('title4').value,
    ],
    sheetsWide:    parseInt(document.getElementById('sheets-wide').value)      || 1,
    sheetsTall:    parseInt(document.getElementById('sheets-tall').value)      || 1,
    tabIn:         parseFloat(document.getElementById('tab-size').value)       || 0.25,
    dungeonCols:   parseInt(document.getElementById('dung-cols').value)        || null,
    dungeonRows:   parseInt(document.getElementById('dung-rows').value)        || null,
    startCol:      parseInt(document.getElementById('start-col').value)        || null,
    startRow:      parseInt(document.getElementById('start-row').value)        || null,
    notesBottomIn: notesEnabled ? (parseFloat(document.getElementById('notes-height').value) || 1.5) : 0,
    fontSize:      fsRaw ? parseInt(fsRaw) : null,
    tabStyle:      document.getElementById('tab-style').value,
  };
}

// ── Preview ───────────────────────────────────────────────────────────────────
function refreshPreview() {
  const wrap   = document.getElementById('preview-wrap');
  const canvas = document.getElementById('preview-canvas');
  const params = readParams();
  const { sheetsWide, sheetsTall } = params;
  const multi = sheetsWide > 1 || sheetsTall > 1;
  const gap = 8;

  if (previewCol !== null) {
    previewCol = Math.min(previewCol, sheetsWide - 1);
    previewRow = Math.min(previewRow, sheetsTall - 1);
  }

  const maxW = wrap.clientWidth  - 32;
  const maxH = wrap.clientHeight - 32;

  if (!multi || previewCol !== null) {
    const col = previewCol ?? 0, row = previewRow ?? 0;
    const dpi = Math.max(30, Math.min(150, Math.floor(Math.min(maxW / params.widthIn, maxH / params.heightIn))));
    generateGraphPaper(canvas, { ...params, dpi, sheetCol: col, sheetRow: row });
    const name = multi ? `Sheet ${indexLabelFromNum(col)}${row + 1}` : '';
    document.getElementById('preview-header').textContent = multi ? `Preview — ${name} (click composite for overview)` : 'Preview';
    document.getElementById('sheet-label').textContent = name;
  } else {
    const scale  = Math.min((maxW - gap*(sheetsWide-1)) / (sheetsWide * params.widthIn),
                            (maxH - gap*(sheetsTall-1)) / (sheetsTall * params.heightIn));
    const dpi = Math.max(20, Math.min(96, Math.floor(scale)));
    const sheetW = Math.round(params.widthIn  * dpi);
    const sheetH = Math.round(params.heightIn * dpi);
    const gapPx  = Math.round(gap * (dpi / 72));

    canvas.width  = sheetsWide * sheetW + (sheetsWide - 1) * gapPx;
    canvas.height = sheetsTall * sheetH + (sheetsTall - 1) * gapPx;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#888';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const off = document.createElement('canvas');
    for (let row = 0; row < sheetsTall; row++) {
      for (let col = 0; col < sheetsWide; col++) {
        generateGraphPaper(off, { ...params, dpi, sheetCol: col, sheetRow: row });
        ctx.drawImage(off, col * (sheetW + gapPx), row * (sheetH + gapPx));
      }
    }
    document.getElementById('preview-header').textContent = `Preview — all ${sheetsWide}×${sheetsTall} sheets (◀▶ to zoom a sheet)`;
    document.getElementById('sheet-label').textContent = '';
  }

  document.getElementById('btn-prev').disabled = (previewCol === null && !multi) || (previewCol === 0 && previewRow === 0);
  document.getElementById('btn-next').disabled = (previewCol === null && !multi) || (previewCol === sheetsWide - 1 && previewRow === sheetsTall - 1);
  document.getElementById('preview-info').textContent =
    `${params.widthIn}×${params.heightIn} in — ${sheetsWide}×${sheetsTall} sheet(s) — ${params.dpi} DPI`;
}

function prevSheet() {
  const { sheetsWide, sheetsTall } = readParams();
  const multi = sheetsWide > 1 || sheetsTall > 1;
  if (!multi) return;
  if (previewCol === null) {
    previewCol = sheetsWide - 1; previewRow = sheetsTall - 1;
  } else if (previewCol > 0) {
    previewCol--;
  } else if (previewRow > 0) {
    previewRow--; previewCol = sheetsWide - 1;
  } else {
    previewCol = null; previewRow = null;
  }
  refreshPreview();
}

function nextSheet() {
  const { sheetsWide, sheetsTall } = readParams();
  const multi = sheetsWide > 1 || sheetsTall > 1;
  if (!multi) return;
  if (previewCol === null) {
    previewCol = 0; previewRow = 0;
  } else if (previewCol < sheetsWide - 1) {
    previewCol++;
  } else if (previewRow < sheetsTall - 1) {
    previewRow++; previewCol = 0;
  } else {
    previewCol = null; previewRow = null;
  }
  refreshPreview();
}

function schedulePreview() {
  previewCol = null; previewRow = null;
  if (previewScheduled) return;
  previewScheduled = true;
  setTimeout(() => { previewScheduled = false; refreshPreview(); }, 250);
}

// ── Generate & Save ───────────────────────────────────────────────────────────
async function generateAndSave() {
  const params = readParams();
  const { sheetsWide, sheetsTall } = params;
  setStatus('Generating…');
  await new Promise(r => setTimeout(r, 10));
  try {
    const off = document.createElement('canvas');
    if (sheetsWide === 1 && sheetsTall === 1) {
      generateGraphPaper(off, { ...params, sheetCol: 0, sheetRow: 0 });
      downloadCanvas(off, 'graph_paper.png');
      setStatus('Saved.');
    } else {
      for (let row = 0; row < sheetsTall; row++) {
        for (let col = 0; col < sheetsWide; col++) {
          generateGraphPaper(off, { ...params, sheetCol: col, sheetRow: row });
          downloadCanvas(off, `graph_paper_${indexLabelFromNum(col)}${row+1}.png`);
          await new Promise(r => setTimeout(r, 60));
        }
      }
      setStatus(`Saved ${sheetsWide * sheetsTall} sheets.`);
    }
  } catch(e) { setStatus(`Error: ${e.message}`); }
}

function downloadCanvas(canvas, filename) {
  const a = document.createElement('a');
  a.download = filename;
  a.href = canvas.toDataURL('image/png');
  a.click();
}

// ── Print ─────────────────────────────────────────────────────────────────────
async function printSheets() {
  const params = readParams();
  const { sheetsWide, sheetsTall, widthIn, heightIn } = params;
  setStatus('Preparing print…');
  await new Promise(r => setTimeout(r, 10));

  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head><title>Graph Paper</title><style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{background:white;}
    .page{width:${widthIn}in;height:${heightIn}in;page-break-after:always;overflow:hidden;}
    .page img{width:100%;height:100%;display:block;}
    @media print{@page{size:${widthIn}in ${heightIn}in;margin:0;}}
  </style></head><body>`);

  const off = document.createElement('canvas');
  for (let row = 0; row < sheetsTall; row++) {
    for (let col = 0; col < sheetsWide; col++) {
      generateGraphPaper(off, { ...params, sheetCol: col, sheetRow: row });
      win.document.write(`<div class="page"><img src="${off.toDataURL('image/png')}"></div>`);
    }
  }
  win.document.write('</body></html>');
  win.document.close();
  win.addEventListener('load', () => win.print());
  setStatus('Ready.');
}

function setStatus(msg) { document.getElementById('status').textContent = msg; }

// ── Page preset ───────────────────────────────────────────────────────────────
function onPagePreset() {
  const val = PAGE_PRESETS[document.getElementById('page-preset').value];
  if (!val) return;
  document.getElementById('width').value  = val[0];
  document.getElementById('height').value = val[1];
  document.getElementById('notes-height').value = val[2];
  schedulePreview();
}

// ── Notes toggle ──────────────────────────────────────────────────────────────
function onNotesToggle() {
  document.getElementById('notes-height').disabled = !document.getElementById('notes-enabled').checked;
  schedulePreview();
}

// ── Auto-sheets ───────────────────────────────────────────────────────────────
function autoSheets(params) {
  if (!params.dungeonCols || !params.dungeonRows) return { sw: 1, st: 1 };
  const usableW = params.widthIn  - 2 * params.marginIn - params.tabIn;
  const usableH = params.heightIn - 2 * params.marginIn - params.tabIn - params.notesBottomIn;
  const boxIn   = params.boxCells * params.gridSizeIn;
  const dungW   = params.dungeonCols * params.gridSizeIn;
  const dungH   = params.dungeonRows * params.gridSizeIn;
  return {
    sw: Math.max(1, Math.ceil(dungW / usableW)),
    st: Math.max(1, Math.ceil((dungH + boxIn) / usableH)),
  };
}

// ── Dungeon presets ───────────────────────────────────────────────────────────
const GRID_SIZE_MAP = {
  '1/8 inch':'0.125','3/16 inch':'0.1875','1/4 inch':'0.25',
  '5/16 inch':'0.3125','1/2 inch':'0.5','1 inch':'1',
};

function onDungeonPreset() {
  const name = document.getElementById('dng-select').value;
  if (!name || !dungeonPresets[name]) return;
  const q = dungeonPresets[name];

  document.getElementById('width').value  = q.page_w;
  document.getElementById('height').value = q.page_h;
  if (q.notes_in != null) document.getElementById('notes-height').value = q.notes_in;
  if (q.dungeon_cols) document.getElementById('dung-cols').value = q.dungeon_cols;
  if (q.dungeon_rows) document.getElementById('dung-rows').value = q.dungeon_rows;
  document.getElementById('start-col').value = q.start_col || '';
  document.getElementById('start-row').value = q.start_row || '';
  if (q.grid_size && GRID_SIZE_MAP[q.grid_size])
    document.getElementById('grid-size').value = GRID_SIZE_MAP[q.grid_size];

  if (q.sheets_wide != null && q.sheets_tall != null) {
    document.getElementById('sheets-wide').value = q.sheets_wide;
    document.getElementById('sheets-tall').value = q.sheets_tall;
  } else {
    const { sw, st } = autoSheets(readParams());
    document.getElementById('sheets-wide').value = sw;
    document.getElementById('sheets-tall').value = st;
  }
  schedulePreview();
}

function savePreset() {
  const cur  = document.getElementById('dng-select').value;
  const name = prompt('Preset name:', cur || '');
  if (!name || !name.trim()) return;
  const params = readParams();
  const gsEl = document.getElementById('grid-size');
  dungeonPresets[name.trim()] = {
    page_w: params.widthIn, page_h: params.heightIn,
    notes_in: params.notesBottomIn,
    dungeon_cols: params.dungeonCols, dungeon_rows: params.dungeonRows,
    start_col: params.startCol, start_row: params.startRow,
    grid_size: gsEl.options[gsEl.selectedIndex].text,
    sheets_wide: params.sheetsWide, sheets_tall: params.sheetsTall,
  };
  savePresetsToStorage();
  refreshPresetList();
  document.getElementById('dng-select').value = name.trim();
  setStatus(`Saved preset "${name.trim()}".`);
}

function deletePreset() {
  const name = document.getElementById('dng-select').value;
  if (!name || !dungeonPresets[name]) return;
  if (!confirm(`Delete preset "${name}"?`)) return;
  delete dungeonPresets[name];
  savePresetsToStorage();
  refreshPresetList();
  setStatus(`Deleted "${name}".`);
}

function refreshPresetList() {
  const sel = document.getElementById('dng-select');
  const cur = sel.value;
  sel.innerHTML = '';
  const blank = document.createElement('option');
  blank.value = ''; blank.textContent = '— select dungeon —';
  sel.appendChild(blank);
  for (const k of Object.keys(dungeonPresets)) {
    const opt = document.createElement('option');
    opt.value = k; opt.textContent = k;
    sel.appendChild(opt);
  }
  if (dungeonPresets[cur]) sel.value = cur;
}

function savePresetsToStorage() {
  try { localStorage.setItem('gpDungeonPresets', JSON.stringify(dungeonPresets)); } catch(_e) { /* ignore */ }
}

function loadPresets() {
  dungeonPresets = { ...BUILTIN_PRESETS };
  try {
    const stored = localStorage.getItem('gpDungeonPresets');
    if (stored) Object.assign(dungeonPresets, JSON.parse(stored));
  } catch(_e) { /* ignore */ }
  refreshPresetList();

  if (location.protocol === 'file:') return;
  fetch('dungeon_presets.json')
    .then(r => r.json())
    .then(data => {
      let custom = {};
      try { custom = JSON.parse(localStorage.getItem('gpDungeonPresets') || '{}'); } catch(_e) { /* ignore */ }
      dungeonPresets = { ...data, ...custom };
      refreshPresetList();
    })
    .catch(() => {});
}

// ── Init ──────────────────────────────────────────────────────────────────────
function init() {
  const pageSel = document.getElementById('page-preset');
  for (const [name, val] of Object.entries(PAGE_PRESETS)) {
    const opt = document.createElement('option');
    opt.value = name; opt.textContent = name;
    if (!val) { opt.disabled = true; }
    pageSel.appendChild(opt);
  }
  pageSel.value = 'Letter (8.5×11)';
  pageSel.addEventListener('change', onPagePreset);

  document.getElementById('dng-select').addEventListener('change', onDungeonPreset);
  document.getElementById('notes-enabled').addEventListener('change', onNotesToggle);
  document.getElementById('tab-style').addEventListener('change', () => {
    const insert = document.getElementById('tab-style').value === 'insert';
    document.getElementById('tab-hint').textContent = insert
      ? 'Red: cut comb tabs on strip edge. Green: cut slots on mating edge. Tabs insert from behind, fold flat — writing surface stays clean.'
      : 'Cut shaded edge, tape under neighbour sheet.';
    schedulePreview();
  });

  document.querySelectorAll('#sidebar input, #sidebar select').forEach(el => {
    el.addEventListener('change', schedulePreview);
    if (el.type !== 'checkbox' && el.type !== 'color')
      el.addEventListener('input', schedulePreview);
  });

  loadPresets();
  window.addEventListener('resize', schedulePreview);
  setTimeout(refreshPreview, 150);
}

document.addEventListener('DOMContentLoaded', init);
