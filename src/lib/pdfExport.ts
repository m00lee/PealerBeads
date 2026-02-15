// ============================================================
// PealerBeads – PDF Export with Row/Column Labels (Excel-style)
// Chinese text rendered via Canvas→Image to avoid jsPDF CJK issues
// ============================================================

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type {
  MappedPixel,
  GridDimensions,
  ColorStat,
  ColorSystem,
} from '@/types';
import { TRANSPARENT_KEY } from './pixelEditing';
import { getDisplayKey } from './colorSystem';
import { assignSymbols } from './exportUtils';

// ---- Column label helpers (Excel-style: A, B, ... Z, AA, AB, ...) ----

export function columnLabel(index: number): string {
  let label = '';
  let n = index;
  while (n >= 0) {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  }
  return label;
}

export function rowLabel(index: number, startIndex: number): string {
  return String(index + startIndex);
}

// ---- Paper size definitions (mm) ----

interface PaperDef {
  width: number;
  height: number;
}

const PAPER_SIZES: Record<string, PaperDef> = {
  a4: { width: 210, height: 297 },
  a3: { width: 297, height: 420 },
  letter: { width: 215.9, height: 279.4 },
};

// ---- Helpers ----

function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

// ---- Canvas-based text rendering for CJK ----
// jsPDF built-in fonts lack CJK glyphs → garbled output.
// We render text onto an offscreen <canvas> (which uses system fonts)
// and embed as a PNG image.

const TEXT_SCALE = 3;

function drawTextAsImage(
  doc: jsPDF,
  text: string,
  xMm: number,
  yMm: number,
  fontSizePt: number,
  color: string,
  align: 'left' | 'center' | 'right' = 'left',
) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  const px = fontSizePt * TEXT_SCALE;
  const fontStr = `${px}px "Noto Sans SC","Microsoft YaHei","PingFang SC","Hiragino Sans GB",sans-serif`;
  ctx.font = fontStr;
  const metrics = ctx.measureText(text);
  const tw = Math.ceil(metrics.width) + 6;
  const th = Math.ceil(px * 1.35) + 6;
  canvas.width = tw;
  canvas.height = th;
  ctx.font = fontStr;
  ctx.fillStyle = color;
  ctx.textBaseline = 'top';
  ctx.fillText(text, 3, 3);

  const imgData = canvas.toDataURL('image/png');
  const mmPerPx = 0.264583 / TEXT_SCALE;
  const imgW = tw * mmPerPx;
  const imgH = th * mmPerPx;

  let drawX = xMm;
  if (align === 'center') drawX = xMm - imgW / 2;
  else if (align === 'right') drawX = xMm - imgW;

  doc.addImage(imgData, 'PNG', drawX, yMm - imgH * 0.75, imgW, imgH);
}

function hasCJK(text: string): boolean {
  return /[^\x00-\x7F]/.test(text);
}

/** Use canvas image for CJK text, native jsPDF for ASCII */
function smartText(
  doc: jsPDF,
  text: string,
  xMm: number,
  yMm: number,
  fontSizePt: number,
  r: number, g: number, b: number,
  align: 'left' | 'center' | 'right' = 'left',
) {
  if (hasCJK(text)) {
    drawTextAsImage(doc, text, xMm, yMm, fontSizePt, `rgb(${r},${g},${b})`, align);
  } else {
    doc.setFontSize(fontSizePt);
    doc.setTextColor(r, g, b);
    doc.text(text, xMm, yMm, { align });
  }
}

// ---- PDF Export Settings ----

export interface PdfExportOptions {
  paperSize: 'a4' | 'a3' | 'letter';
  orientation: 'portrait' | 'landscape';
  showGrid: boolean;
  showSymbols: boolean;
  showLabels: boolean;
  showLegend: boolean;
  showColorBlocks: boolean;
  gridBoldEvery: 5 | 10;
  startIndex: number;
  cellSizeMm: number;  // 0 = auto-fit to page
  title: string;
}

const DEFAULT_OPTIONS: PdfExportOptions = {
  paperSize: 'a4',
  orientation: 'portrait',
  showGrid: true,
  showSymbols: true,
  showLabels: true,
  showLegend: true,
  showColorBlocks: true,
  gridBoldEvery: 5,
  startIndex: 1,
  cellSizeMm: 0,
  title: 'Bead Pattern',
};

// ---- Main export ----

export function exportPDF(
  pixels: MappedPixel[][],
  dims: GridDimensions,
  stats: ColorStat[],
  system: ColorSystem,
  options: Partial<PdfExportOptions> = {},
  filename?: string,
) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const { N, M } = dims;
  const paper = PAPER_SIZES[opts.paperSize];
  const symbolMap = assignSymbols(stats);

  const actualPageW = opts.orientation === 'landscape' ? paper.height : paper.width;
  const actualPageH = opts.orientation === 'landscape' ? paper.width : paper.height;

  const marginTop = 14;
  const marginBottom = 10;
  const marginLeft = 10;
  const marginRight = 10;
  const labelSpaceTop = opts.showLabels ? 8 : 0;
  const labelSpaceLeft = opts.showLabels ? 10 : 0;
  const titleSpace = 8;

  const usableW = actualPageW - marginLeft - marginRight - labelSpaceLeft;
  const usableH = actualPageH - marginTop - marginBottom - labelSpaceTop - titleSpace;

  // ---- Determine cell size ----
  let cellMm: number;
  if (opts.cellSizeMm <= 0) {
    // Auto-fit: scale so the entire grid fits on one page, limited by shortest edge
    const fitW = usableW / N;
    const fitH = usableH / M;
    cellMm = Math.min(fitW, fitH);
    cellMm = Math.max(0.5, Math.min(cellMm, 15));
  } else {
    cellMm = opts.cellSizeMm;
  }

  const colsPerPage = Math.min(N, Math.floor(usableW / cellMm));
  const rowsPerPage = Math.min(M, Math.floor(usableH / cellMm));
  if (colsPerPage <= 0 || rowsPerPage <= 0) {
    alert('Grid too large for paper');
    return;
  }

  const pagesX = Math.ceil(N / colsPerPage);
  const pagesY = Math.ceil(M / rowsPerPage);
  const totalGridPages = pagesX * pagesY;

  const doc = new jsPDF({
    orientation: opts.orientation,
    unit: 'mm',
    format: opts.paperSize,
  });

  let pageIndex = 0;
  for (let py = 0; py < pagesY; py++) {
    for (let px = 0; px < pagesX; px++) {
      if (pageIndex > 0) doc.addPage();

      const startCol = px * colsPerPage;
      const startRow = py * rowsPerPage;
      const endCol = Math.min(startCol + colsPerPage, N);
      const endRow = Math.min(startRow + rowsPerPage, M);
      const pageColCount = endCol - startCol;
      const pageRowCount = endRow - startRow;

      // ---- Center grid on page ----
      const gridW = pageColCount * cellMm;
      const gridH = pageRowCount * cellMm;
      const gridX0 = marginLeft + labelSpaceLeft + (usableW - gridW) / 2;
      const gridY0 = marginTop + titleSpace + labelSpaceTop + (usableH - gridH) / 2;

      // ---- Title (supports CJK) ----
      const titleText = totalGridPages > 1
        ? `${opts.title}  -  Page ${pageIndex + 1}/${totalGridPages}  (${columnLabel(startCol)}-${columnLabel(endCol - 1)}, ${rowLabel(startRow, opts.startIndex)}-${rowLabel(endRow - 1, opts.startIndex)})`
        : opts.title;
      smartText(doc, titleText, marginLeft, marginTop, 9, 80, 80, 80);

      // ---- Column labels (ASCII) ----
      if (opts.showLabels) {
        doc.setFontSize(Math.min(5.5, cellMm * 1.2));
        doc.setTextColor(100, 100, 100);
        for (let c = startCol; c < endCol; c++) {
          const x = gridX0 + (c - startCol) * cellMm + cellMm / 2;
          const y = gridY0 - 1.5;
          doc.text(columnLabel(c), x, y, { align: 'center' });
        }
      }

      // ---- Row labels (ASCII) ----
      if (opts.showLabels) {
        doc.setFontSize(Math.min(5.5, cellMm * 1.2));
        doc.setTextColor(100, 100, 100);
        for (let r = startRow; r < endRow; r++) {
          const x = gridX0 - 1.5;
          const y = gridY0 + (r - startRow) * cellMm + cellMm / 2 + 0.8;
          doc.text(rowLabel(r, opts.startIndex), x, y, { align: 'right' });
        }
      }

      // ---- Cells ----
      for (let r = startRow; r < endRow; r++) {
        for (let c = startCol; c < endCol; c++) {
          const cell = pixels[r]?.[c];
          const localC = c - startCol;
          const localR = r - startRow;
          const cx = gridX0 + localC * cellMm;
          const cy = gridY0 + localR * cellMm;
          const hasBead = cell && !cell.isExternal && cell.key !== TRANSPARENT_KEY;

          if (hasBead && opts.showColorBlocks) {
            const [cr, cg, cb] = hexToRgb(cell.color);
            doc.setFillColor(cr, cg, cb);
            doc.rect(cx, cy, cellMm, cellMm, 'F');
          } else {
            doc.setFillColor(255, 255, 255);
            doc.rect(cx, cy, cellMm, cellMm, 'F');
          }

          if (opts.showSymbols && hasBead) {
            const sym = symbolMap.get(cell.color.toUpperCase());
            if (sym) {
              const lum = luminance(cell.color);
              const tc = opts.showColorBlocks ? (lum > 0.5 ? 0 : 255) : 0;
              doc.setTextColor(tc, tc, tc);
              doc.setFontSize(Math.min(cellMm * 1.8, 12));
              doc.text(sym, cx + cellMm / 2, cy + cellMm * 0.72, { align: 'center' });
            }
          }
        }
      }

      // ---- Grid lines ----
      if (opts.showGrid) {
        const boldEvery = opts.gridBoldEvery;
        for (let c = startCol; c <= endCol; c++) {
          const x = gridX0 + (c - startCol) * cellMm;
          const isBold = c % boldEvery === 0;
          doc.setDrawColor(isBold ? 60 : 180);
          doc.setLineWidth(isBold ? 0.3 : 0.1);
          doc.line(x, gridY0, x, gridY0 + gridH);
        }
        for (let r = startRow; r <= endRow; r++) {
          const y = gridY0 + (r - startRow) * cellMm;
          const isBold = r % boldEvery === 0;
          doc.setDrawColor(isBold ? 60 : 180);
          doc.setLineWidth(isBold ? 0.3 : 0.1);
          doc.line(gridX0, y, gridX0 + gridW, y);
        }
      }

      // ---- Footer (ASCII) ----
      doc.setFontSize(6);
      doc.setTextColor(160, 160, 160);
      doc.text(
        `${N}x${M} | ${stats.length} colors | PealerBeads`,
        actualPageW - marginRight, actualPageH - 4, { align: 'right' },
      );

      pageIndex++;
    }
  }

  // ---- Legend: try to fit on the last grid page, otherwise add a new page ----
  if (opts.showLegend && stats.length > 0) {
    const legendTitleH = 12; // space for title + subtitle
    const rowH = 5.5; // approx row height in the table (fontSize 7 + padding)
    const headerH = 7; // table header row
    const legendNeeded = legendTitleH + headerH + stats.length * rowH + 4;

    // Calculate remaining space on the last grid page
    // The last page had grid ending at gridY0 + gridH (for the last py/px)
    const lastPy = pagesY - 1;
    const lastStartRow = lastPy * rowsPerPage;
    const lastEndRow = Math.min(lastStartRow + rowsPerPage, M);
    const lastRowCount = lastEndRow - lastStartRow;
    const lastGridH = lastRowCount * cellMm;
    const lastGridY0 = marginTop + titleSpace + labelSpaceTop + (usableH - lastGridH) / 2;
    const lastGridBottom = lastGridY0 + lastGridH;
    const remainingOnLastPage = actualPageH - lastGridBottom - marginBottom;

    let legendStartY: number;
    if (remainingOnLastPage >= legendNeeded) {
      // Fit legend on the same page — place it below the grid with some gap
      legendStartY = lastGridBottom + 6;
    } else {
      // Not enough space — add a new page
      doc.addPage();
      legendStartY = marginTop;
    }

    smartText(doc, 'Color Legend', marginLeft, legendStartY, 11, 40, 40, 40);
    smartText(
      doc,
      `${opts.title}  |  ${N}x${M}  |  Total: ${stats.reduce((s, c) => s + c.count, 0)}`,
      marginLeft, legendStartY + 6, 7, 100, 100, 100,
    );

    // Calculate available height for the table
    const tableStartY = legendStartY + 10;
    const tableAvailH = actualPageH - tableStartY - marginBottom;

    // If space is tight, use multi-column layout
    const singleColH = headerH + stats.length * rowH;
    const useMultiCol = singleColH > tableAvailH && stats.length > 6;

    if (useMultiCol) {
      // Split into 2 or 3 columns side by side
      const colGap = 4;
      const availW = actualPageW - marginLeft - marginRight;
      const numCols = singleColH > tableAvailH * 2 ? 3 : 2;
      const colW = (availW - colGap * (numCols - 1)) / numCols;
      const rowsPerCol = Math.ceil(stats.length / numCols);

      for (let ci = 0; ci < numCols; ci++) {
        const colStats = stats.slice(ci * rowsPerCol, (ci + 1) * rowsPerCol);
        if (colStats.length === 0) continue;
        const colX = marginLeft + ci * (colW + colGap);

        const tableHead = [['Sym', 'Color', 'Code', 'Qty', '%']];
        const tableBody = colStats.map((s) => {
          const sym = symbolMap.get(s.hex.toUpperCase()) ?? '';
          const displayKey = getDisplayKey(s.hex, system);
          return [sym, '', displayKey, String(s.count), `${s.percentage.toFixed(1)}%`];
        });

        autoTable(doc, {
          startY: tableStartY,
          head: tableHead,
          body: tableBody,
          theme: 'grid',
          styles: {
            fontSize: 6,
            cellPadding: 1,
            lineColor: [200, 200, 200],
            lineWidth: 0.1,
          },
          headStyles: {
            fillColor: [60, 60, 60],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            halign: 'center',
          },
          columnStyles: {
            0: { halign: 'center', cellWidth: colW * 0.14 },
            1: { cellWidth: colW * 0.14 },
            2: { halign: 'center', cellWidth: colW * 0.3 },
            3: { halign: 'right', cellWidth: colW * 0.2 },
            4: { halign: 'right', cellWidth: colW * 0.2 },
          },
          didDrawCell: (data: any) => {
            if (data.section === 'body' && data.column.index === 1) {
              const rowIdx = data.row.index;
              if (rowIdx < colStats.length) {
                const hex = colStats[rowIdx].hex;
                const [r, g, b] = hexToRgb(hex);
                const cDoc = data.doc as jsPDF;
                cDoc.setFillColor(r, g, b);
                const pad = 0.8;
                cDoc.roundedRect(
                  data.cell.x + pad, data.cell.y + pad,
                  data.cell.width - pad * 2, data.cell.height - pad * 2,
                  0.8, 0.8, 'F',
                );
              }
            }
          },
          tableWidth: colW,
          margin: { left: colX, right: actualPageW - colX - colW },
        });
      }
    } else {
      // Single column layout (fits or new page)
      const tableHead = [['Sym', 'Color', 'Code', 'Qty', '%']];
      const tableBody = stats.map((s) => {
        const sym = symbolMap.get(s.hex.toUpperCase()) ?? '';
        const displayKey = getDisplayKey(s.hex, system);
        return [sym, '', displayKey, String(s.count), `${s.percentage.toFixed(1)}%`];
      });

      autoTable(doc, {
        startY: tableStartY,
        head: tableHead,
        body: tableBody,
        theme: 'grid',
        styles: {
          fontSize: 7,
          cellPadding: 1.5,
          lineColor: [200, 200, 200],
          lineWidth: 0.1,
        },
        headStyles: {
          fillColor: [60, 60, 60],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          halign: 'center',
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: 14 },
          1: { cellWidth: 14 },
          2: { halign: 'center', cellWidth: 22 },
          3: { halign: 'right', cellWidth: 18 },
          4: { halign: 'right', cellWidth: 18 },
        },
        didDrawCell: (data: any) => {
          if (data.section === 'body' && data.column.index === 1) {
            const rowIdx = data.row.index;
            if (rowIdx < stats.length) {
              const hex = stats[rowIdx].hex;
              const [r, g, b] = hexToRgb(hex);
              const cDoc = data.doc as jsPDF;
              cDoc.setFillColor(r, g, b);
              const pad = 1;
              cDoc.roundedRect(
                data.cell.x + pad, data.cell.y + pad,
                data.cell.width - pad * 2, data.cell.height - pad * 2,
                1, 1, 'F',
              );
            }
          }
        },
        margin: { left: marginLeft, right: marginRight },
      });
    }
  }

  doc.save(filename || `${opts.title}.pdf`);
}
