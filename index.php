<?php

/**
 * index.php — Graph Paper Builder web UI (PHP/GD)
 * Serve with: php -S localhost:8080
 */

require_once __DIR__ . '/generate_graph_paper.php';

$presets = [];
$presetsFile = __DIR__ . '/dungeon_presets.json';
if (file_exists($presetsFile)) {
    $presets = json_decode(file_get_contents($presetsFile), true) ?? [];
}

$gridSizes = [
    '1/8 inch'  => 0.125,
    '3/16 inch' => 0.1875,
    '1/4 inch'  => 0.25,
    '5/16 inch' => 0.3125,
    '3/8 inch'  => 0.375,
    '1/2 inch'  => 0.5,
];

// ── handle form submission ────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $gridKey   = $_POST['grid_size']  ?? '1/4 inch';
    if ($gridKey === 'custom') {
        $raw = trim($_POST['custom_grid_size'] ?? '0.25');
        if (str_contains($raw, '/')) {
            [$n, $d] = explode('/', $raw, 2);
            $gridSzIn = floatval(trim($n)) / max(1e-9, floatval(trim($d)));
        } else {
            $gridSzIn = floatval($raw) ?: 0.25;
        }
    } else {
        $gridSzIn  = $gridSizes[$gridKey] ?? 0.25;
    }
    $boxCells  = max(1, (int) ($_POST['box_cells'] ?? 4));

    $params = [
        'width_in'       => (float) ($_POST['width']       ?? 8.5),
        'height_in'      => (float) ($_POST['height']      ?? 11.0),
        'dpi'            => (int) ($_POST['dpi']           ?? 150),
        'grid_size_in'   => $gridSzIn,
        'box_size_in'    => $boxCells * $gridSzIn,
        'margin_in'      => (float) ($_POST['margin']      ?? 0.25),
        'dashed'         => isset($_POST['dashed']),
        'title_lines'    => [
            $_POST['title1'] ?? 'Ginger Plays Games',
            $_POST['title2'] ?? 'Double Dungeons',
            $_POST['title3'] ?? '',
            $_POST['title4'] ?? '',
        ],
        'notes_bottom_in' => isset($_POST['notes_enabled']) ? (float) ($_POST['notes_in'] ?? 1.5) : 0.0,
        'tab_style'      => $_POST['tab_style'] ?? 'tape',
        'dungeon_cols'   => $_POST['dungeon_cols'] ? (int) $_POST['dungeon_cols'] : null,
        'dungeon_rows'   => $_POST['dungeon_rows'] ? (int) $_POST['dungeon_rows'] : null,
        'start_col'      => $_POST['start_col'] ? (int) $_POST['start_col'] : null,
        'start_row'      => $_POST['start_row'] ? (int) $_POST['start_row'] : null,
    ];

    $sw = max(1, (int) ($_POST['sheets_wide'] ?? 1));
    $st = max(1, (int) ($_POST['sheets_tall'] ?? 1));

    if ($sw === 1 && $st === 1) {
        // Single sheet — serve PNG directly
        $img = generate_graph_paper($params);
        header('Content-Type: image/png');
        header('Content-Disposition: attachment; filename="graph_paper.png"');
        imagepng($img);
        imagedestroy($img);
        exit;
    }

    // Multi-sheet — serve ZIP
    $sheets = generate_all_sheets($sw, $st, $params);
    $zip = new ZipArchive();
    $zipFile = tempnam(sys_get_temp_dir(), 'gp_') . '.zip';
    $zip->open($zipFile, ZipArchive::CREATE);
    foreach ($sheets as $s) {
        ob_start();
        imagepng($s['img']);
        $pngData = ob_get_clean();
        imagedestroy($s['img']);
        $col = gp_index_label($s['col']);
        $zip->addFromString(sprintf('sheet_%s%s.png', $col, $s['row']), $pngData);
    }
    $zip->close();
    header('Content-Type: application/zip');
    header('Content-Disposition: attachment; filename="graph_paper_sheets.zip"');
    header('Content-Length: ' . filesize($zipFile));
    readfile($zipFile);
    unlink($zipFile);
    exit;
}

// ── GET — show form ───────────────────────────────────────────────────────────
$presetJson = json_encode(array_keys($presets));
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Graph Paper Builder</title>
<style>
  body { font-family: monospace; font-size: 13px; background: #f0f0f0; margin: 0; }
  h1   { margin: 0; font-size: 15px; }
  .wrap{ display: flex; gap: 16px; padding: 12px; }
  .panel { background: #fff; border: 1px solid #ccc; border-radius: 4px; padding: 10px; }
  .section { margin-bottom: 10px; }
  .section-title { font-weight: bold; font-size: 11px; text-transform: uppercase;
                   color: #666; border-bottom: 1px solid #eee; margin-bottom: 6px; }
  .field { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
  .field label { width: 110px; text-align: right; flex-shrink: 0; }
  input[type=text], input[type=number], select { width: 120px; padding: 2px 4px; font-family: monospace; }
  input[type=checkbox] { width: auto; }
  .pair { display: flex; gap: 6px; align-items: center; }
  .pair input { width: 50px; }
  .pair label { width: auto; }
  button { padding: 6px 16px; font-family: monospace; cursor: pointer; }
  .btn-primary { background: #2a5; color: white; border: none; border-radius: 3px; }
  .btn-primary:hover { background: #1a4; }
  select[multiple] { height: 220px; width: 240px; }
</style>
</head>
<body>
<div class="wrap">
<form method="post" class="panel" style="min-width:320px">

  <div class="section">
    <div class="section-title">Dungeon Preset</div>
    <div class="field">
      <label>Preset:</label>
      <select id="preset-sel" onchange="applyPreset(this.value)">
        <option value="">— select —</option>
        <?php foreach (array_keys($presets) as $name) : ?>
        <option value="<?= htmlspecialchars((string) $name) ?>"><?= htmlspecialchars((string) $name) ?></option>
        <?php endforeach; ?>
      </select>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Page</div>
    <div class="field"><label>Width (in):</label>
      <input type="number" name="width" id="width" value="8.5" step="0.5" min="1" max="60"></div>
    <div class="field"><label>Height (in):</label>
      <input type="number" name="height" id="height" value="11" step="0.5" min="1" max="60"></div>
    <div class="field"><label>DPI:</label>
      <input type="number" name="dpi" id="dpi" value="150" step="50" min="72" max="600"></div>
    <div class="field"><label>Margin (in):</label>
      <input type="number" name="margin" value="0.25" step="0.125" min="0"></div>
  </div>

  <div class="section">
    <div class="section-title">Grid</div>
    <div class="field"><label>Grid size:</label>
      <select name="grid_size" id="grid_size" onchange="toggleCustomGrid()">
        <?php foreach (array_keys($gridSizes) as $k) : ?>
        <option value="<?= $k ?>" <?= $k === '1/4 inch' ? 'selected' : '' ?>><?= $k ?></option>
        <?php endforeach; ?>
        <option value="custom">Custom…</option>
      </select>
      <input type="text" name="custom_grid_size" id="custom_grid_size" placeholder="e.g. 3/16" style="display:none;width:5em">
    </div>
    <div class="field"><label>Box interval (cells):</label>
      <input type="number" name="box_cells" id="box_cells" value="4" min="1" max="200"></div>
    <div class="field"><label>Dashed lines:</label>
      <input type="checkbox" name="dashed" checked></div>
  </div>

  <div class="section">
    <div class="section-title">Title Block</div>
    <div class="field"><label>Line 1:</label>
      <input type="text" name="title1" value="Ginger Plays Games"></div>
    <div class="field"><label>Line 2:</label>
      <input type="text" name="title2" value="Double Dungeons"></div>
    <div class="field"><label>Line 3:</label>
      <input type="text" name="title3" value=""></div>
    <div class="field"><label>Line 4:</label>
      <input type="text" name="title4" value=""></div>
  </div>

  <div class="section">
    <div class="section-title">Notes Area</div>
    <div class="field"><label>Enable notes:</label>
      <input type="checkbox" name="notes_enabled" id="notes_enabled" onchange="toggleNotes(this)" checked></div>
    <div class="field" id="notes_row"><label>Height (in):</label>
      <input type="number" name="notes_in" id="notes_in" value="1.5" step="0.25" min="0.25" max="4"></div>
  </div>

  <div class="section">
    <div class="section-title">Multi-Sheet</div>
    <div class="field"><label>Sheets:</label>
      <div class="pair">
        <input type="number" name="sheets_wide" id="sheets_wide" value="1" min="1" max="10">
        <label>wide ×</label>
        <input type="number" name="sheets_tall" id="sheets_tall" value="1" min="1" max="10">
        <label>tall</label>
      </div>
    </div>
    <div class="field"><label>Tab style:</label>
      <select name="tab_style">
        <option value="tape">Tape under</option>
        <option value="insert">Tab &amp; slot insert</option>
      </select>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Dungeon</div>
    <div class="field"><label>Cols:</label>
      <input type="number" name="dungeon_cols" id="dungeon_cols" value="" min="1"></div>
    <div class="field"><label>Rows:</label>
      <input type="number" name="dungeon_rows" id="dungeon_rows" value="" min="1"></div>
    <div class="field"><label>Start col:</label>
      <input type="number" name="start_col" id="start_col" value="" min="1"></div>
    <div class="field"><label>Start row:</label>
      <input type="number" name="start_row" id="start_row" value="" min="1"></div>
  </div>

  <button type="submit" class="btn-primary">Generate &amp; Download</button>
</form>
</div>

<script>
const PRESETS = <?= json_encode($presets) ?>;
const GRID_SIZES = <?= json_encode(array_keys($gridSizes)) ?>;

function toggleCustomGrid() {
  const show = document.getElementById('grid_size').value === 'custom';
  document.getElementById('custom_grid_size').style.display = show ? '' : 'none';
  if (show) document.getElementById('custom_grid_size').focus();
}

function applyPreset(name) {
  const p = PRESETS[name];
  if (!p) return;
  document.getElementById('width').value        = p.page_w ?? 8.5;
  document.getElementById('height').value       = p.page_h ?? 11;
  document.getElementById('dungeon_cols').value = p.dungeon_cols ?? '';
  document.getElementById('dungeon_rows').value = p.dungeon_rows ?? '';
  document.getElementById('start_col').value    = p.start_col ?? '';
  document.getElementById('start_row').value    = p.start_row ?? '';
  if (p.notes_in !== undefined) document.getElementById('notes_in').value = p.notes_in;
  if (p.grid_size) {
    if (GRID_SIZES.includes(p.grid_size)) {
      document.getElementById('grid_size').value = p.grid_size;
    } else {
      document.getElementById('grid_size').value = 'custom';
      document.getElementById('custom_grid_size').value = p.grid_size;
    }
    toggleCustomGrid();
  }
  if (p.sheets_wide) document.getElementById('sheets_wide').value = p.sheets_wide;
  if (p.sheets_tall) document.getElementById('sheets_tall').value = p.sheets_tall;
}

function toggleNotes(cb) {
  document.getElementById('notes_row').style.display = cb.checked ? '' : 'none';
}
</script>
</body>
</html>
