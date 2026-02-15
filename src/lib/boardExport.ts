// ============================================================
// PealerBeads - Board Export (规则化板型分割导出)
// ============================================================
//
// Splits a large pixel grid into standard perler bead board sizes
// and renders each page as a labeled PNG.
// Supports different board sizes and stacking modes.
//
// Board stacking modes:
//   standard  — simple rectangular grid of boards
//   hexDense  — offset every other row by half-board width (六密堆叠)
//   brick     — offset every other row by half-board width (砖砌堆叠)

import type {
  MappedPixel,
  GridDimensions,
  ColorStat,
  BoardSizePreset,
  BoardStacking,
  BoardExportSettings,
} from '@/types';
import { TRANSPARENT_KEY } from './pixelEditing';
import { assignSymbols } from './exportUtils';
import { drawBead } from './canvasUtils';

// ---- Standard Board Size Presets ----
export const BOARD_PRESETS: BoardSizePreset[] = [
  { label: '8×8 迷你板', cols: 8, rows: 8 },
  { label: '12×12 小板', cols: 12, rows: 12 },
  { label: '16×16 中板', cols: 16, rows: 16 },
  { label: '24×24 大板', cols: 24, rows: 24 },
  { label: '28×28 标准板', cols: 28, rows: 28 },
  { label: '29×29 方板', cols: 29, rows: 29 },
  { label: '58×29 长板', cols: 58, rows: 29 },
];

// ---- Board Stacking Options ----
export const STACKING_OPTIONS: { key: BoardStacking; label: string; desc: string }[] = [
  { key: 'standard', label: '标准排列', desc: '按行列整齐排列' },
  { key: 'hexDense', label: '六密堆叠', desc: '奇数行偏移半板宽度' },
  { key: 'brick', label: '砖砌堆叠', desc: '奇数行偏移半板宽度' },
];

// ---- Compute board pages ----

export interface BoardPage {
  /** Page index (0-based) */
  index: number;
  /** Board grid position (boardRow, boardCol) */
  boardRow: number;
  boardCol: number;
  /** Pixel range in the full grid */
  startRow: number;
  startCol: number;
  endRow: number;   // exclusive
  endCol: number;    // exclusive
  /** Label for display */
  label: string;
}

/**
 * Calculate all board pages needed to cover the full pixel grid.
 */
export function calculateBoardPages(
  dims: GridDimensions,
  boardSize: BoardSizePreset,
  stacking: BoardStacking
): BoardPage[] {
  const { N, M } = dims;
  const bCols = boardSize.cols;
  const bRows = boardSize.rows;

  const pages: BoardPage[] = [];
  let idx = 0;

  if (stacking === 'standard') {
    // Simple grid layout
    const numBoardCols = Math.ceil(N / bCols);
    const numBoardRows = Math.ceil(M / bRows);
    for (let br = 0; br < numBoardRows; br++) {
      for (let bc = 0; bc < numBoardCols; bc++) {
        pages.push({
          index: idx++,
          boardRow: br,
          boardCol: bc,
          startRow: br * bRows,
          startCol: bc * bCols,
          endRow: Math.min((br + 1) * bRows, M),
          endCol: Math.min((bc + 1) * bCols, N),
          label: `板 ${br + 1}-${bc + 1}`,
        });
      }
    }
  } else {
    // hex-dense / brick — offset odd rows by half board width
    const halfCols = Math.floor(bCols / 2);
    const numBoardRows = Math.ceil(M / bRows);
    // For each board row, determine offset and number of boards
    for (let br = 0; br < numBoardRows; br++) {
      const isOddRow = br % 2 === 1;
      const offsetCols = isOddRow ? halfCols : 0;
      // How many boards needed for this row
      const effectiveWidth = N + (isOddRow ? halfCols : 0);
      const numBoardCols = Math.ceil(effectiveWidth / bCols);
      for (let bc = 0; bc < numBoardCols; bc++) {
        const startCol = bc * bCols - offsetCols;
        const endCol = startCol + bCols;
        const startRow = br * bRows;
        const endRow = Math.min((br + 1) * bRows, M);
        // Only create page if it overlaps with the actual grid
        const clampedStartCol = Math.max(0, startCol);
        const clampedEndCol = Math.min(N, endCol);
        if (clampedStartCol < clampedEndCol && startRow < M) {
          pages.push({
            index: idx++,
            boardRow: br,
            boardCol: bc,
            startRow,
            startCol: clampedStartCol,
            endRow,
            endCol: clampedEndCol,
            label: `板 ${br + 1}-${bc + 1}${isOddRow ? ' (偏移)' : ''}`,
          });
        }
      }
    }
  }

  return pages;
}

// ---- Render a single board page ----

export function renderBoardPage(
  pixels: MappedPixel[][],
  page: BoardPage,
  boardSize: BoardSizePreset,
  cellSize: number,
  options: {
    showGrid: boolean;
    showSymbols: boolean;
    showBoardBorder: boolean;
    showPageNumber: boolean;
    showLegend: boolean;
    beadMode: boolean;
    symbolMap?: Map<string, string>;
    boldEvery?: number;
  }
): HTMLCanvasElement {
  const bCols = boardSize.cols;
  const bRows = boardSize.rows;

  // Canvas size: board + margin for labels
  const marginTop = options.showPageNumber ? 28 : 4;
  const marginBottom = 4;
  const marginLeft = 4;
  const marginRight = 4;

  const canvas = document.createElement('canvas');
  const gridW = bCols * cellSize;
  const gridH = bRows * cellSize;
  canvas.width = gridW + marginLeft + marginRight;
  canvas.height = gridH + marginTop + marginBottom;
  const ctx = canvas.getContext('2d')!;

  // Background
  if (options.beadMode) {
    ctx.fillStyle = '#e8e0d4';
  } else {
    ctx.fillStyle = '#FFFFFF';
  }
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Page label
  if (options.showPageNumber) {
    ctx.fillStyle = '#333';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(page.label, marginLeft, 4);

    // Coordinates reference
    ctx.font = '10px sans-serif';
    ctx.fillStyle = '#888';
    ctx.textAlign = 'right';
    ctx.fillText(
      `行 ${page.startRow + 1}-${page.endRow} / 列 ${page.startCol + 1}-${page.endCol}`,
      canvas.width - marginRight,
      6
    );
  }

  ctx.save();
  ctx.translate(marginLeft, marginTop);

  // Draw pegboard dots for bead mode
  if (options.beadMode) {
    ctx.fillStyle = '#d4ccc0';
    for (let j = 0; j < bRows; j++) {
      for (let i = 0; i < bCols; i++) {
        ctx.beginPath();
        ctx.arc(i * cellSize + cellSize / 2, j * cellSize + cellSize / 2, cellSize * 0.06, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Draw cells
  const lumCache = new Map<string, number>();
  for (let j = 0; j < bRows; j++) {
    const srcRow = page.startRow + j;
    for (let i = 0; i < bCols; i++) {
      const srcCol = page.startCol + i;
      const cell = pixels[srcRow]?.[srcCol];
      const hasBead = cell && !cell.isExternal && cell.key !== TRANSPARENT_KEY;

      if (options.beadMode) {
        if (hasBead) {
          drawBead(ctx, i * cellSize + cellSize / 2, j * cellSize + cellSize / 2, cellSize / 2, cell.color);
        }
      } else {
        if (hasBead) {
          ctx.fillStyle = cell.color;
        } else {
          ctx.fillStyle = '#FFFFFF';
        }
        ctx.fillRect(i * cellSize, j * cellSize, cellSize, cellSize);
      }

      // Symbols overlay
      if (options.showSymbols && options.symbolMap && hasBead) {
        const sym = options.symbolMap.get(cell.color.toUpperCase());
        if (sym) {
          const hexUpper = cell.color.toUpperCase();
          let lum = lumCache.get(hexUpper);
          if (lum === undefined) {
            const hex = hexUpper.replace('#', '');
            const r = parseInt(hex.substring(0, 2), 16);
            const g = parseInt(hex.substring(2, 4), 16);
            const b = parseInt(hex.substring(4, 6), 16);
            lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
            lumCache.set(hexUpper, lum);
          }
          ctx.fillStyle = lum > 0.5 ? '#000000' : '#FFFFFF';
          ctx.font = `bold ${Math.max(6, cellSize * 0.4)}px monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(sym, i * cellSize + cellSize / 2, j * cellSize + cellSize / 2);
        }
      }
    }
  }

  // Grid lines
  if (options.showGrid && !options.beadMode) {
    const boldEvery = options.boldEvery ?? 5;
    for (let i = 0; i <= bCols; i++) {
      const isBold = i % boldEvery === 0;
      ctx.strokeStyle = isBold ? '#333' : '#CCC';
      ctx.lineWidth = isBold ? 1.5 : 0.5;
      ctx.beginPath();
      ctx.moveTo(i * cellSize, 0);
      ctx.lineTo(i * cellSize, bRows * cellSize);
      ctx.stroke();
    }
    for (let j = 0; j <= bRows; j++) {
      const isBold = j % boldEvery === 0;
      ctx.strokeStyle = isBold ? '#333' : '#CCC';
      ctx.lineWidth = isBold ? 1.5 : 0.5;
      ctx.beginPath();
      ctx.moveTo(0, j * cellSize);
      ctx.lineTo(bCols * cellSize, j * cellSize);
      ctx.stroke();
    }
  }

  // Board border
  if (options.showBoardBorder) {
    ctx.strokeStyle = '#E53E3E';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, bCols * cellSize, bRows * cellSize);
  }

  ctx.restore();
  return canvas;
}

// ---- Render overview with all boards outlined ----

export function renderBoardOverview(
  pixels: MappedPixel[][],
  dims: GridDimensions,
  pages: BoardPage[],
  boardSize: BoardSizePreset,
  cellSize: number,
  beadMode: boolean
): HTMLCanvasElement {
  const { N, M } = dims;
  const canvas = document.createElement('canvas');
  canvas.width = N * cellSize;
  canvas.height = M * cellSize;
  const ctx = canvas.getContext('2d')!;

  // Background
  if (beadMode) {
    ctx.fillStyle = '#e8e0d4';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // Draw all cells
  for (let j = 0; j < M; j++) {
    for (let i = 0; i < N; i++) {
      const cell = pixels[j]?.[i];
      const hasBead = cell && !cell.isExternal && cell.key !== TRANSPARENT_KEY;
      if (beadMode) {
        if (hasBead) {
          drawBead(ctx, i * cellSize + cellSize / 2, j * cellSize + cellSize / 2, cellSize / 2, cell.color);
        }
      } else {
        if (hasBead) {
          ctx.fillStyle = cell.color;
        } else {
          ctx.fillStyle = '#FFFFFF';
        }
        ctx.fillRect(i * cellSize, j * cellSize, cellSize, cellSize);
      }
    }
  }

  // Draw board boundaries
  ctx.strokeStyle = '#E53E3E';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 3]);
  for (const page of pages) {
    const x = page.startCol * cellSize;
    const y = page.startRow * cellSize;
    const w = (page.endCol - page.startCol) * cellSize;
    const h = (page.endRow - page.startRow) * cellSize;
    ctx.strokeRect(x, y, w, h);

    // Label
    ctx.setLineDash([]);
    ctx.fillStyle = '#E53E3E';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(page.label, x + 3, y + 3);
    ctx.setLineDash([6, 3]);
  }
  ctx.setLineDash([]);

  return canvas;
}

// ---- Download all board pages as individual PNGs ----

export async function downloadBoardPages(
  pixels: MappedPixel[][],
  dims: GridDimensions,
  stats: ColorStat[],
  settings: BoardExportSettings,
  projectName: string
) {
  const pages = calculateBoardPages(dims, settings.boardSize, settings.stacking);
  const symbolMap = settings.showSymbols ? assignSymbols(stats) : undefined;

  for (const page of pages) {
    const canvas = renderBoardPage(pixels, page, settings.boardSize, settings.cellSize, {
      showGrid: settings.showGrid,
      showSymbols: settings.showSymbols,
      showBoardBorder: settings.showBoardBorders,
      showPageNumber: settings.showPageNumbers,
      showLegend: settings.showLegend,
      beadMode: true,
      symbolMap,
    });

    // Download
    const link = document.createElement('a');
    link.download = `${projectName}_${page.label.replace(/\s/g, '_')}.png`;
    const url = canvas.toDataURL('image/png');
    link.href = url;
    link.click();
    // Small delay between downloads to avoid browser throttling
    await new Promise((r) => setTimeout(r, 200));
    URL.revokeObjectURL(url);
  }

  // Also export overview
  const overview = renderBoardOverview(pixels, dims, pages, settings.boardSize, Math.max(4, settings.cellSize / 2), true);
  const link = document.createElement('a');
  link.download = `${projectName}_总览.png`;
  const url = overview.toDataURL('image/png');
  link.href = url;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
