<?php
/**
 * generate_graph_paper.php
 * PHP/GD port of the graph paper generator.
 * Requires: PHP 8.0+, GD with FreeType support (php-gd).
 */

// ── font resolution ──────────────────────────────────────────────────────────

function gp_find_font(): ?string {
    $candidates = [
        'C:\Windows\Fonts\cour.ttf',
        'C:\Windows\Fonts\arial.ttf',
        'C:\Windows\Fonts\calibri.ttf',
        '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf',
        '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
        '/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf',
        '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
        '/System/Library/Fonts/Courier.ttc',
        '/System/Library/Fonts/Helvetica.ttc',
    ];
    foreach ($candidates as $f) {
        if (file_exists($f)) return $f;
    }
    return null;
}

// ── helpers ───────────────────────────────────────────────────────────────────

function gp_index_label(int $n): string {
    $s = '';
    while (true) {
        $s = chr(ord('A') + ($n % 26)) . $s;
        $n = intdiv($n, 26) - 1;
        if ($n < 0) break;
    }
    return $s;
}

function gp_color(\GdImage $img, array $rgb): int {
    return imagecolorallocate($img, $rgb[0], $rgb[1], $rgb[2]);
}

function gp_dashed_line(\GdImage $img, int $x1, int $y1, int $x2, int $y2,
                         int $color, int $width, int $dashLen, int $gapLen): void {
    $dx = $x2 - $x1;
    $dy = $y2 - $y1;
    $len = sqrt($dx * $dx + $dy * $dy);
    if ($len < 1) return;
    $ux = $dx / $len;
    $uy = $dy / $len;
    $pos = 0;
    imagesetthickness($img, $width);
    while ($pos < $len) {
        $end = min($pos + $dashLen, $len);
        imageline($img,
            (int)($x1 + $ux * $pos),  (int)($y1 + $uy * $pos),
            (int)($x1 + $ux * $end),  (int)($y1 + $uy * $end),
            $color);
        $pos += $dashLen + $gapLen;
    }
    imagesetthickness($img, 1);
}

function gp_rounded_rect(\GdImage $img, int $x1, int $y1, int $x2, int $y2,
                          int $radius, int $color, int $width): void {
    imagesetthickness($img, $width);
    $d = $radius * 2;
    // straight edges
    imageline($img, $x1 + $radius, $y1,  $x2 - $radius, $y1,  $color);
    imageline($img, $x1 + $radius, $y2,  $x2 - $radius, $y2,  $color);
    imageline($img, $x1, $y1 + $radius,  $x1, $y2 - $radius,  $color);
    imageline($img, $x2, $y1 + $radius,  $x2, $y2 - $radius,  $color);
    // corners
    imagearc($img, $x1 + $radius, $y1 + $radius, $d, $d, 180, 270, $color);
    imagearc($img, $x2 - $radius, $y1 + $radius, $d, $d, 270, 360, $color);
    imagearc($img, $x1 + $radius, $y2 - $radius, $d, $d,  90, 180, $color);
    imagearc($img, $x2 - $radius, $y2 - $radius, $d, $d,   0,  90, $color);
    imagesetthickness($img, 1);
}

/**
 * Draw text centered at (cx, cy). Uses TTF if font path provided, else GD built-in.
 * $angle: 0 = horizontal, 90 = rotated CCW (up the page).
 */
function gp_text(\GdImage $img, string $text, int $cx, int $cy,
                 int $color, float $ptSize, ?string $font, float $angle = 0): void {
    if ($font && function_exists('imagettftext')) {
        $bbox = imagettfbbox($ptSize, $angle, $font, $text);
        // bbox corners: [0,1]=bl [2,3]=br [4,5]=tr [6,7]=tl  (rotated)
        $w = abs($bbox[4] - $bbox[6]);
        $h = abs($bbox[7] - $bbox[1]);
        $x = (int)($cx - $w / 2);
        $y = (int)($cy + $h / 2);
        // For 90° rotation GD rotates CCW; baseline x/y shift
        if (abs($angle - 90) < 1) {
            $x = (int)($cx + $h / 2);
            $y = (int)($cy + $w / 2);
        }
        imagettftext($img, $ptSize, $angle, $x, $y, $color, $font, $text);
    } else {
        // Fall back to built-in font (no rotation, limited sizes)
        $gdFont = max(1, min(5, (int)($ptSize / 4)));
        $fw = imagefontwidth($gdFont) * strlen($text);
        $fh = imagefontheight($gdFont);
        imagestring($img, $gdFont, $cx - (int)($fw / 2), $cy - (int)($fh / 2), $text, $color);
    }
}

function gp_seam_tabs(int $seamTop, int $seamBot, int $gridPx, int $boxPx): array {
    $seamLen   = $seamBot - $seamTop;
    $period    = max($gridPx * 4, (int)($boxPx * 1.2));
    $nPeriods  = max(2, (int)round($seamLen / $period));
    $actPeriod = $seamLen / $nPeriods;
    $tabH      = (int)round($actPeriod * 0.5);
    $tabs = [];
    for ($i = 0; $i < $nPeriods; $i++) {
        $gapTop = $seamTop + (int)($i * $actPeriod);
        $tabTop = $gapTop + (int)(($actPeriod - $tabH) / 2);
        $tabs[] = [$gapTop, $tabTop, $tabTop + $tabH, $gapTop + (int)$actPeriod];
    }
    return $tabs;
}

// ── main generator ────────────────────────────────────────────────────────────

/**
 * Generate a single sheet of graph paper.
 *
 * @param array $p  Parameter array — keys mirror Python function args.
 * @return \GdImage
 */
function generate_graph_paper(array $p): \GdImage {
    $widthIn      = $p['width_in']       ?? 8.5;
    $heightIn     = $p['height_in']      ?? 11.0;
    $dpi          = $p['dpi']            ?? 150;
    $lineColor    = $p['line_color']     ?? [173, 216, 230];
    $heavyColor   = $p['heavy_color']    ?? [173, 216, 230];
    $indexColor   = $p['index_color']    ?? [40, 60, 120];
    $lineThick    = $p['line_thickness'] ?? 1;
    $heavyThick   = $p['heavy_thickness']?? 2;
    $marginIn     = $p['margin_in']      ?? 0.25;
    $gridSizeIn   = $p['grid_size_in']   ?? 0.25;
    $boxSizeIn    = $p['box_size_in']    ?? 1.0;
    $dashed       = $p['dashed']         ?? true;
    $titleLines   = $p['title_lines']    ?? null;
    $sheetCol     = $p['sheet_col']      ?? 0;
    $sheetRow     = $p['sheet_row']      ?? 0;
    $sheetsWide   = $p['sheets_wide']    ?? 1;
    $sheetsTall   = $p['sheets_tall']    ?? 1;
    $tabIn        = $p['tab_in']         ?? 0.25;
    $notesIn      = $p['notes_bottom_in']?? 0.0;
    $startCol     = $p['start_col']      ?? null;
    $startRow     = $p['start_row']      ?? null;
    $dungeonCols  = $p['dungeon_cols']   ?? null;
    $dungeonRows  = $p['dungeon_rows']   ?? null;
    $tabStyle     = $p['tab_style']      ?? 'tape';

    $widthPx   = (int)($widthIn  * $dpi);
    $heightPx  = (int)($heightIn * $dpi);
    $marginPx  = (int)($marginIn * $dpi);
    $gridPx    = max(1, (int)($gridSizeIn * $dpi));
    $boxPx     = max($gridPx, (int)($boxSizeIn * $dpi));
    $gridPerBox= max(1, (int)round($boxPx / $gridPx));
    $tabPx     = ($sheetsWide > 1 || $sheetsTall > 1) ? (int)($tabIn * $dpi) : 0;
    $notesPx   = ($sheetRow == $sheetsTall - 1) ? (int)($notesIn * $dpi) : 0;
    $dashLen   = max(4, (int)($dpi * 0.045));

    $font      = gp_find_font();
    $ptSize    = max(1.0, $boxPx * 0.18 * 72 / $dpi);   // px → pt approximation
    $labelPt   = max(1.0, ($gridPx / 2) * 72 / $dpi);
    $titlePt   = max(1.0, $boxPx * 0.22 * 72 / $dpi);

    if ($titleLines === null) {
        $titleLines = [
            'Ginger Plays Games',
            'Double Dungeons',
            '',
            '',
        ];
    }

    $usableW   = $widthPx  - 2 * $marginPx;
    $usableH   = $heightPx - 2 * $marginPx - $notesPx;
    $contentW  = max(1, $usableW - $tabPx);
    $contentH  = max(1, $usableH - $tabPx);
    $xAbsBase  = $sheetCol * $contentW;
    $yAbsBase  = $sheetRow * $contentH;
    $xPhase    = $xAbsBase % $gridPx;
    $yPhase    = $yAbsBase % $gridPx;
    $gridX0    = $marginPx + ($gridPx - $xPhase) % $gridPx;
    $gridY0    = $marginPx + ($gridPx - $yPhase) % $gridPx;
    $gridBottom= $heightPx - $marginPx - $notesPx;
    $padInner  = max(2, (int)($boxPx / 12));

    // ── image ─────────────────────────────────────────────────────────────
    $img = imagecreatetruecolor($widthPx, $heightPx);
    $white   = imagecolorallocate($img, 255, 255, 255);
    imagefill($img, 0, 0, $white);

    $cLine   = gp_color($img, $lineColor);
    $cHeavy  = gp_color($img, $heavyColor);
    $cIndex  = gp_color($img, $indexColor);
    $cLabel  = gp_color($img, [220, 220, 220]);
    $cBlack  = gp_color($img, [0, 0, 0]);
    $cTabFill= gp_color($img, [210, 230, 255]);
    $cSlotFil= gp_color($img, [220, 255, 220]);
    $cCut    = gp_color($img, [200, 40, 40]);
    $cSlot   = gp_color($img, [30, 140, 30]);

    // ── tab shading ───────────────────────────────────────────────────────
    if ($tabPx > 0) {
        if ($sheetCol > 0) {
            if ($tabStyle === 'tape') {
                imagefilledrectangle($img, $marginPx, $marginPx,
                                     $marginPx + $tabPx, $gridBottom, $cTabFill);
            } else {
                $sTop = $sheetRow > 0 ? $marginPx + $tabPx : $marginPx;
                foreach (gp_seam_tabs($sTop, $gridBottom, $gridPx, $boxPx) as [$gt, $tt, $tb, $gb]) {
                    if ($tt > $gt) imagefilledrectangle($img, $marginPx, $gt, $marginPx + $tabPx, $tt, $cTabFill);
                    if ($gb > $tb) imagefilledrectangle($img, $marginPx, $tb, $marginPx + $tabPx, $gb, $cTabFill);
                }
            }
        }
        if ($sheetRow > 0) {
            if ($tabStyle === 'tape') {
                imagefilledrectangle($img, $marginPx, $marginPx,
                                     $widthPx - $marginPx, $marginPx + $tabPx, $cTabFill);
            } else {
                $sLeft = $sheetCol > 0 ? $marginPx + $tabPx : $marginPx;
                foreach (gp_seam_tabs($sLeft, $widthPx - $marginPx, $gridPx, $boxPx) as [$gl, $tl, $tr, $gr]) {
                    if ($tl > $gl) imagefilledrectangle($img, $gl, $marginPx, $tl, $marginPx + $tabPx, $cTabFill);
                    if ($gr > $tr) imagefilledrectangle($img, $tr, $marginPx, $gr, $marginPx + $tabPx, $cTabFill);
                }
            }
        }
        if ($tabStyle === 'insert') {
            if ($sheetCol < $sheetsWide - 1)
                imagefilledrectangle($img, $widthPx - $marginPx - $tabPx, $marginPx,
                                     $widthPx - $marginPx, $gridBottom, $cSlotFil);
            if ($sheetRow < $sheetsTall - 1)
                imagefilledrectangle($img, $marginPx, $gridBottom - $tabPx,
                                     $widthPx - $marginPx, $gridBottom, $cSlotFil);
        }
    }

    // ── grid lines ────────────────────────────────────────────────────────
    for ($x = $gridX0; $x <= $widthPx - $marginPx; $x += $gridPx) {
        $absX    = ($x - $marginPx) + $xAbsBase;
        $isHeavy = (intdiv($absX, $gridPx) % $gridPerBox) === 0;
        $color   = $isHeavy ? $cHeavy : $cLine;
        $thick   = $isHeavy ? $heavyThick : $lineThick;
        if ($dashed) {
            gp_dashed_line($img, $x, $marginPx, $x, $gridBottom, $color, $thick, $dashLen, $dashLen);
        } else {
            imagesetthickness($img, $thick);
            imageline($img, $x, $marginPx, $x, $gridBottom, $color);
            imagesetthickness($img, 1);
        }
    }
    for ($y = $gridY0; $y <= $gridBottom; $y += $gridPx) {
        $absY    = ($y - $marginPx) + $yAbsBase;
        $isHeavy = (intdiv($absY, $gridPx) % $gridPerBox) === 0;
        $color   = $isHeavy ? $cHeavy : $cLine;
        $thick   = $isHeavy ? $heavyThick : $lineThick;
        if ($dashed) {
            gp_dashed_line($img, $marginPx, $y, $widthPx - $marginPx, $y, $color, $thick, $dashLen, $dashLen);
        } else {
            imagesetthickness($img, $thick);
            imageline($img, $marginPx, $y, $widthPx - $marginPx, $y, $color);
            imagesetthickness($img, 1);
        }
    }

    // ── cut / insert guides ───────────────────────────────────────────────
    if ($tabPx > 0) {
        $cutW      = max(1, $heavyThick);
        $guideDash = max(4, (int)($dpi / 15));

        if ($tabStyle === 'tape') {
            if ($sheetCol > 0) {
                $cx = $marginPx + $tabPx;
                gp_dashed_line($img, $cx, 0, $cx, $heightPx, $cCut, $cutW, $guideDash, $guideDash);
                gp_text($img, 'CUT / TAPE UNDER', $marginPx + (int)($tabPx / 2), (int)($heightPx / 2),
                        $cCut, $ptSize, $font, 90);
            }
            if ($sheetRow > 0) {
                $cy = $marginPx + $tabPx;
                gp_dashed_line($img, 0, $cy, $widthPx, $cy, $cCut, $cutW, $guideDash, $guideDash);
                gp_text($img, 'CUT / TAPE UNDER', (int)($widthPx / 2), $marginPx + (int)($tabPx / 2),
                        $cCut, $ptSize, $font, 0);
            }
        } else {
            if ($sheetCol > 0) {
                $cx   = $marginPx + $tabPx;
                $sTop = $sheetRow > 0 ? $marginPx + $tabPx : $marginPx;
                foreach (gp_seam_tabs($sTop, $gridBottom, $gridPx, $boxPx) as [$gt, $tt, $tb, $gb]) {
                    gp_dashed_line($img, $cx, $gt, $cx, $tt,         $cCut, $cutW, $guideDash, $guideDash);
                    gp_dashed_line($img, $cx, $tb, $cx, $gb,         $cCut, $cutW, $guideDash, $guideDash);
                    gp_dashed_line($img, $marginPx, $tt, $cx, $tt,   $cCut, $cutW, $guideDash, $guideDash);
                    gp_dashed_line($img, $marginPx, $tb, $cx, $tb,   $cCut, $cutW, $guideDash, $guideDash);
                }
                gp_text($img, 'CUT TABS / INSERT', $marginPx + (int)($tabPx / 2), (int)($heightPx / 2),
                        $cCut, $ptSize, $font, 90);
            }
            if ($sheetRow > 0) {
                $cy    = $marginPx + $tabPx;
                $sLeft = $sheetCol > 0 ? $marginPx + $tabPx : $marginPx;
                foreach (gp_seam_tabs($sLeft, $widthPx - $marginPx, $gridPx, $boxPx) as [$gl, $tl, $tr, $gr]) {
                    gp_dashed_line($img, $gl, $cy, $tl, $cy,         $cCut, $cutW, $guideDash, $guideDash);
                    gp_dashed_line($img, $tr, $cy, $gr, $cy,         $cCut, $cutW, $guideDash, $guideDash);
                    gp_dashed_line($img, $tl, $marginPx, $tl, $cy,   $cCut, $cutW, $guideDash, $guideDash);
                    gp_dashed_line($img, $tr, $marginPx, $tr, $cy,   $cCut, $cutW, $guideDash, $guideDash);
                }
                gp_text($img, 'CUT TABS / INSERT', (int)($widthPx / 2), $marginPx + (int)($tabPx / 2),
                        $cCut, $ptSize, $font, 0);
            }
            if ($sheetCol < $sheetsWide - 1) {
                $sx0   = $widthPx - $marginPx - $tabPx;
                $sx1   = $widthPx - $marginPx;
                $sTop  = $sheetRow > 0 ? $marginPx + $tabPx : $marginPx;
                foreach (gp_seam_tabs($sTop, $gridBottom, $gridPx, $boxPx) as [, $tt, $tb,]) {
                    imagesetthickness($img, $cutW);
                    imagerectangle($img, $sx0, $tt, $sx1, $tb, $cSlot);
                    imagesetthickness($img, 1);
                }
                gp_text($img, 'CUT SLOTS', $sx0 + (int)($tabPx / 2), (int)($gridBottom / 2),
                        $cSlot, $ptSize, $font, 90);
            }
            if ($sheetRow < $sheetsTall - 1) {
                $sy0   = $gridBottom - $tabPx;
                $sy1   = $gridBottom;
                $sLeft = $sheetCol > 0 ? $marginPx + $tabPx : $marginPx;
                foreach (gp_seam_tabs($sLeft, $widthPx - $marginPx, $gridPx, $boxPx) as [, $tl, $tr,]) {
                    imagesetthickness($img, $cutW);
                    imagerectangle($img, $tl, $sy0, $tr, $sy1, $cSlot);
                    imagesetthickness($img, 1);
                }
                gp_text($img, 'CUT SLOTS', (int)($widthPx / 2), $sy0 + (int)($tabPx / 2),
                        $cSlot, $ptSize, $font, 0);
            }
        }
    }

    // ── index labels ─────────────────────────────────────────────────────
    $labelCy = (int)($marginPx / 2);
    $labelCx = (int)($marginPx / 2);
    for ($x = $gridX0; $x <= $widthPx - $marginPx; $x += $gridPx) {
        $absX = ($x - $marginPx) + $xAbsBase;
        if (intdiv($absX, $gridPx) % $gridPerBox === 0) {
            gp_text($img, gp_index_label(intdiv($absX, $gridPx)),
                    $x + (int)($gridPx / 2), $labelCy, $cLabel, $labelPt, $font);
        }
    }
    for ($y = $gridY0; $y <= $gridBottom; $y += $gridPx) {
        $absY = ($y - $marginPx) + $yAbsBase;
        if (intdiv($absY, $gridPx) % $gridPerBox === 0) {
            gp_text($img, (string)(intdiv($absY, $gridPx) + 1),
                    $labelCx, $y + (int)($gridPx / 2), $cLabel, $labelPt, $font);
        }
    }

    // ── title block ───────────────────────────────────────────────────────
    if ($sheetCol === 0 && $sheetRow === 0) {
        $blockW  = $boxPx * 2;
        $blockH  = $boxPx;
        $radius  = max(2, (int)($boxPx / 8));
        gp_rounded_rect($img, $marginPx, $marginPx,
                         $marginPx + $blockW, $marginPx + $blockH,
                         $radius, $cBlack, max(1, $heavyThick));
        $blockCx    = $marginPx + (int)($blockW / 2);
        $activeLines= array_values(array_filter($titleLines, fn($l) => trim($l) !== ''));
        $nActive    = max(1, count($activeLines));
        $lineGap    = max(1, (int)($boxPx / 20));
        $totalTextH = (int)($nActive * $titlePt + ($nActive - 1) * $lineGap);
        $textY      = $marginPx + (int)(($blockH - $totalTextH) / 2) + (int)($titlePt / 2);
        foreach ($activeLines as $line) {
            gp_text($img, $line, $blockCx, $textY, $cBlack, $titlePt, $font);
            $textY += (int)$titlePt + $lineGap;
        }
    }

    // ── sheet label ───────────────────────────────────────────────────────
    if ($sheetsWide > 1 || $sheetsTall > 1) {
        $label = 'Sheet ' . gp_index_label($sheetCol) . ($sheetRow + 1);
        gp_text($img, $label,
                $widthPx - $marginPx - $boxPx,
                $heightPx - $marginPx - (int)($ptSize) - 2,
                $cLabel, $ptSize, $font);
    }

    // ── dungeon border ────────────────────────────────────────────────────
    $dungOriginY = $boxPx;
    $dungXOff    = 0;
    $dungYOff    = 0;

    if ($dungeonCols && $dungeonRows) {
        $totalW  = $sheetsWide * $contentW;
        $totalH  = $sheetsTall * $contentH - $dungOriginY;
        $dungW   = $dungeonCols * $gridPx;
        $dungH   = $dungeonRows * $gridPx;
        $rawX    = max(0, (int)(($totalW - $dungW) / 2));
        $rawY    = max(0, (int)(($totalH - $dungH) / 2));
        $dungXOff= (intdiv($rawX, $gridPx)) * $gridPx;
        $dungYOff= (intdiv($rawY, $gridPx)) * $gridPx;

        $lx  = $marginPx + $dungXOff                   - $xAbsBase;
        $ty  = $marginPx + $dungOriginY + $dungYOff    - $yAbsBase;
        $rx  = $marginPx + $dungXOff + $dungW          - $xAbsBase;
        $by  = $marginPx + $dungOriginY + $dungYOff + $dungH - $yAbsBase;
        $sx0 = $marginPx;
        $sy0 = $marginPx;
        $sx1 = $widthPx  - $marginPx;
        $sy1 = $gridBottom;

        $cBorder = gp_color($img, [60, 60, 60]);
        $bw      = max(2, $heavyThick + 1);
        imagesetthickness($img, $bw);

        $hline = function(int $y, int $x0, int $x1) use ($img, $cBorder, $sx0, $sx1) {
            $x0 = max($x0, $sx0); $x1 = min($x1, $sx1);
            if ($x0 < $x1) imageline($img, $x0, $y, $x1, $y, $cBorder);
        };
        $vline = function(int $x, int $y0, int $y1) use ($img, $cBorder, $sy0, $sy1) {
            $y0 = max($y0, $sy0); $y1 = min($y1, $sy1);
            if ($y0 < $y1) imageline($img, $x, $y0, $x, $y1, $cBorder);
        };

        if ($sy0 <= $ty && $ty <= $sy1) $hline($ty, $lx, $rx);
        if ($sy0 <= $by && $by <= $sy1) $hline($by, $lx, $rx);
        if ($sx0 <= $lx && $lx <= $sx1) $vline($lx, $ty, $by);
        if ($sx0 <= $rx && $rx <= $sx1) $vline($rx, $ty, $by);
        imagesetthickness($img, 1);

        // dungeon-relative labels
        $cDLabel = gp_color($img, $indexColor);
        if ($sy0 <= $ty && $ty <= $sy1) {
            $ly = $ty - (int)($gridPx / 2);
            if ($ly >= 0) {
                for ($x = $lx; $x < $rx; $x += $gridPx) {
                    $mid = $x + (int)($gridPx / 2);
                    if ($mid >= $sx0 && $mid <= $sx1)
                        gp_text($img, gp_index_label(intdiv($x - $lx, $gridPx)),
                                $mid, $ly, $cDLabel, $labelPt, $font);
                }
            }
        }
        if ($sx0 <= $lx && $lx <= $sx1) {
            $lx2 = $lx - (int)($gridPx / 2);
            if ($lx2 >= 0) {
                for ($y = $ty; $y < $by; $y += $gridPx) {
                    $mid = $y + (int)($gridPx / 2);
                    if ($mid >= $sy0 && $mid <= $sy1)
                        gp_text($img, (string)(intdiv($y - $ty, $gridPx) + 1),
                                $lx2, $mid, $cDLabel, $labelPt, $font);
                }
            }
        }
    }

    // ── start marker ─────────────────────────────────────────────────────
    if ($startCol !== null && $startRow !== null) {
        $absSx   = $dungXOff + ($startCol - 1) * $gridPx;
        $absSy   = $dungYOff + ($startRow - 1) * $gridPx;
        $localSx = $marginPx + ($absSx - $xAbsBase);
        $localSy = $marginPx + $dungOriginY + ($absSy - $yAbsBase);
        if ($localSx >= $marginPx && $localSx < $widthPx - $marginPx
            && $localSy >= $marginPx && $localSy < $gridBottom) {
            $cStart = gp_color($img, [255, 255, 180]);
            imagefilledrectangle($img, $localSx, $localSy,
                                 $localSx + $gridPx, $localSy + $gridPx, $cStart);
            gp_text($img, 'S', $localSx + (int)($gridPx / 2), $localSy + (int)($gridPx / 2),
                    gp_color($img, [180, 120, 0]), $ptSize, $font);
        }
    }

    // ── notes area ────────────────────────────────────────────────────────
    if ($notesPx > 0) {
        $rulePx  = max($gridPx, (int)(0.25 * $dpi));
        imagesetthickness($img, max(1, $heavyThick));
        imageline($img, $marginPx, $gridBottom, $widthPx - $marginPx, $gridBottom, $cBlack);
        imagesetthickness($img, 1);
        $notesLabelX = $marginPx + ($sheetCol > 0 ? $tabPx : 0) + $padInner;
        gp_text($img, 'Notes', $notesLabelX + 20, $gridBottom + $padInner + 10, $cIndex, $ptSize, $font);
        for ($y = $gridBottom + $rulePx; $y <= $heightPx - $marginPx; $y += $rulePx) {
            imageline($img, $marginPx, $y, $widthPx - $marginPx, $y, $cLine);
        }
    }

    return $img;
}

// ── multi-sheet ───────────────────────────────────────────────────────────────

/**
 * Generate all sheets. Returns array of ['col'=>, 'row'=>, 'img'=>GdImage].
 */
function generate_all_sheets(int $sheetsWide, int $sheetsTall, array $params): array {
    $sheets = [];
    for ($row = 0; $row < $sheetsTall; $row++) {
        for ($col = 0; $col < $sheetsWide; $col++) {
            $p = array_merge($params, [
                'sheet_col'   => $col,
                'sheet_row'   => $row,
                'sheets_wide' => $sheetsWide,
                'sheets_tall' => $sheetsTall,
            ]);
            $sheets[] = ['col' => $col, 'row' => $row, 'img' => generate_graph_paper($p)];
        }
    }
    return $sheets;
}
