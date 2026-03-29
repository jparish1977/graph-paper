/* global DEFAULTS, UI, PAGE_PRESETS, BUILTIN_PRESETS */
/* global generateGraphPaper, indexLabelFromNum, hexToRgb */

let dungeonPresets = {};
let previewScheduled = false;

function parseFraction(s) {
  s = (s || '').trim();
  if (s.includes('/')) { const [n, d] = s.split('/'); return parseFloat(n) / parseFloat(d); }
  return parseFloat(s);
}

// eslint-disable-next-line no-unused-vars -- called from HTML
function toggleCustomGrid() {
  const show = document.getElementById('grid-size').value === 'custom';
  document.getElementById('grid-size-custom').style.display = show ? '' : 'none';
  if (show) document.getElementById('grid-size-custom').focus();
}
let previewCol = null, previewRow = null;

// ── Read params ───────────────────────────────────────────────────────────────
function readParams(dpiOverride) {
  const notesEnabled = document.getElementById('notes-enabled').checked;
  const fsRaw = document.getElementById('font-size').value.trim();
  return {
    widthIn:       parseFloat(document.getElementById('width').value)          || DEFAULTS.WIDTH_IN,
    heightIn:      parseFloat(document.getElementById('height').value)         || DEFAULTS.HEIGHT_IN,
    dpi:           dpiOverride || parseInt(document.getElementById('dpi').value) || DEFAULTS.DPI,
    marginIn:      parseFloat(document.getElementById('margin').value)         || DEFAULTS.MARGIN_IN,
    gridSizeIn:    (() => {
      const el = document.getElementById('grid-size');
      if (el.value === 'custom') return parseFraction(document.getElementById('grid-size-custom').value) || DEFAULTS.GRID_SIZE_IN;
      return parseFloat(el.value) || DEFAULTS.GRID_SIZE_IN;
    })(),
    boxCells:      parseInt(document.getElementById('box-cells').value)        || DEFAULTS.BOX_CELLS,
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
    tabIn:         parseFloat(document.getElementById('tab-size').value)       || DEFAULTS.TAB_IN,
    dungeonCols:   parseInt(document.getElementById('dung-cols').value)        || null,
    dungeonRows:   parseInt(document.getElementById('dung-rows').value)        || null,
    startCol:      parseInt(document.getElementById('start-col').value)        || null,
    startRow:      parseInt(document.getElementById('start-row').value)        || null,
    notesBottomIn: notesEnabled ? (parseFloat(document.getElementById('notes-height').value) || DEFAULTS.NOTES_HEIGHT) : 0,
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

  const maxW = wrap.clientWidth  - UI.DUNGEON_MIN_SIZE;
  const maxH = wrap.clientHeight - UI.DUNGEON_MIN_SIZE;

  if (!multi || previewCol !== null) {
    const col = previewCol ?? 0, row = previewRow ?? 0;
    const dpi = Math.max(UI.CANVAS_MIN_W, Math.min(UI.CANVAS_MAX_W, Math.floor(Math.min(maxW / params.widthIn, maxH / params.heightIn))));
    generateGraphPaper(canvas, { ...params, dpi, sheetCol: col, sheetRow: row });
    const name = multi ? `Sheet ${indexLabelFromNum(col)}${row + 1}` : '';
    document.getElementById('preview-header').textContent = multi ? `Preview — ${name} (click composite for overview)` : 'Preview';
    document.getElementById('sheet-label').textContent = name;
  } else {
    const scale  = Math.min((maxW - gap*(sheetsWide-1)) / (sheetsWide * params.widthIn),
                            (maxH - gap*(sheetsTall-1)) / (sheetsTall * params.heightIn));
    const dpi = Math.max(UI.CANVAS_MIN_H, Math.min(UI.CANVAS_MAX_H, Math.floor(scale)));
    const sheetW = Math.round(params.widthIn  * dpi);
    const sheetH = Math.round(params.heightIn * dpi);
    const gapPx  = Math.round(gap * (dpi / UI.CANVAS_DPI));

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

// eslint-disable-next-line no-unused-vars -- called from HTML
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

// eslint-disable-next-line no-unused-vars -- called from HTML
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
  setTimeout(() => { previewScheduled = false; refreshPreview(); }, UI.PREVIEW_DELAY_MS);
}

// ── Generate & Save ───────────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars -- called from HTML
async function generateAndSave() {
  const params = readParams();
  const { sheetsWide, sheetsTall } = params;
  setStatus('Generating…');
  await new Promise(r => setTimeout(r, UI.SHEET_DELAY_MS));
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
          await new Promise(r => setTimeout(r, UI.PRINT_DELAY_MS));
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
// eslint-disable-next-line no-unused-vars -- called from HTML
async function printSheets() {
  const params = readParams();
  const { sheetsWide, sheetsTall, widthIn, heightIn } = params;
  setStatus('Preparing print…');
  await new Promise(r => setTimeout(r, UI.SHEET_DELAY_MS));

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
  if (q.grid_size) {
    if (GRID_SIZE_MAP[q.grid_size]) {
      document.getElementById('grid-size').value = GRID_SIZE_MAP[q.grid_size];
    } else {
      document.getElementById('grid-size').value = 'custom';
      document.getElementById('grid-size-custom').value = q.grid_size;
    }
    toggleCustomGrid();
  }

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

// eslint-disable-next-line no-unused-vars -- called from HTML
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
    grid_size: gsEl.value === 'custom'
      ? document.getElementById('grid-size-custom').value
      : gsEl.options[gsEl.selectedIndex].text,
    sheets_wide: params.sheetsWide, sheets_tall: params.sheetsTall,
  };
  savePresetsToStorage();
  refreshPresetList();
  document.getElementById('dng-select').value = name.trim();
  setStatus(`Saved preset "${name.trim()}".`);
}

// eslint-disable-next-line no-unused-vars -- called from HTML
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
  setTimeout(refreshPreview, UI.PREVIEW_DPI);
}

document.addEventListener('DOMContentLoaded', init);
