// ============================================================
// PealerBeads – Export Utilities (PNG, PDF, CSV, JSON)
// ============================================================

import type {
  MappedPixel,
  GridDimensions,
  ColorStat,
  ExportSettings,
  ColorSystem,
} from '@/types';
import { TRANSPARENT_KEY } from './pixelEditing';
import { getDisplayKey } from './colorSystem';

// ---- Symbol Assignment ----

const SYMBOLS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz0123456789@#$%&*+~'.split('');

export function assignSymbols(stats: ColorStat[]): Map<string, string> {
  const map = new Map<string, string>();
  stats.forEach((s, i) => {
    map.set(s.hex, SYMBOLS[i % SYMBOLS.length]);
  });
  return map;
}

// ---- PNG Export ----

export function renderGridToCanvas(
  pixels: MappedPixel[][],
  dims: GridDimensions,
  cellSize: number,
  options: {
    showGrid: boolean;
    showSymbols: boolean;
    symbolMap?: Map<string, string>;
    boldEvery?: number;
  }
): HTMLCanvasElement {
  const { N, M } = dims;
  const canvas = document.createElement('canvas');
  canvas.width = N * cellSize;
  canvas.height = M * cellSize;
  const ctx = canvas.getContext('2d')!;

  // Draw cells
  for (let j = 0; j < M; j++) {
    for (let i = 0; i < N; i++) {
      const cell = pixels[j]?.[i];
      if (cell && !cell.isExternal && cell.key !== TRANSPARENT_KEY) {
        ctx.fillStyle = cell.color;
      } else {
        ctx.fillStyle = '#FFFFFF';
      }
      ctx.fillRect(i * cellSize, j * cellSize, cellSize, cellSize);
    }
  }

  // Draw grid
  if (options.showGrid) {
    const boldEvery = options.boldEvery ?? 5;
    ctx.strokeStyle = '#CCCCCC';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= N; i++) {
      if (i % boldEvery === 0) {
        ctx.strokeStyle = '#333333';
        ctx.lineWidth = 1.5;
      } else {
        ctx.strokeStyle = '#CCCCCC';
        ctx.lineWidth = 0.5;
      }
      ctx.beginPath();
      ctx.moveTo(i * cellSize, 0);
      ctx.lineTo(i * cellSize, M * cellSize);
      ctx.stroke();
    }
    for (let j = 0; j <= M; j++) {
      if (j % boldEvery === 0) {
        ctx.strokeStyle = '#333333';
        ctx.lineWidth = 1.5;
      } else {
        ctx.strokeStyle = '#CCCCCC';
        ctx.lineWidth = 0.5;
      }
      ctx.beginPath();
      ctx.moveTo(0, j * cellSize);
      ctx.lineTo(N * cellSize, j * cellSize);
      ctx.stroke();
    }
  }

  // Draw symbols
  if (options.showSymbols && options.symbolMap) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const fontSize = Math.max(8, cellSize * 0.5);
    ctx.font = `bold ${fontSize}px monospace`;

    for (let j = 0; j < M; j++) {
      for (let i = 0; i < N; i++) {
        const cell = pixels[j]?.[i];
        if (cell && !cell.isExternal && cell.key !== TRANSPARENT_KEY) {
          const sym = options.symbolMap.get(cell.color.toUpperCase());
          if (sym) {
            // Choose black or white text based on luminance
            const hex = cell.color.replace('#', '');
            const r = parseInt(hex.substring(0, 2), 16);
            const g = parseInt(hex.substring(2, 4), 16);
            const b = parseInt(hex.substring(4, 6), 16);
            const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
            ctx.fillStyle = lum > 0.5 ? '#000000' : '#FFFFFF';
            ctx.fillText(sym, i * cellSize + cellSize / 2, j * cellSize + cellSize / 2);
          }
        }
      }
    }
  }

  return canvas;
}

export function downloadCanvas(canvas: HTMLCanvasElement, filename: string) {
  const link = document.createElement('a');
  link.download = filename;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

// ---- CSV Export ----

export function exportCSV(
  stats: ColorStat[],
  system: ColorSystem,
  filename: string
) {
  const header = '色号,HEX,数量,占比(%)';
  const rows = stats.map(
    (s) => `${getDisplayKey(s.hex, system)},${s.hex},${s.count},${s.percentage.toFixed(1)}`
  );
  const csv = [header, ...rows].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}

// ---- JSON Export ----

export function exportJSON(
  pixels: MappedPixel[][],
  dims: GridDimensions,
  stats: ColorStat[],
  filename: string
) {
  const data = {
    version: '1.0',
    grid: { cols: dims.N, rows: dims.M },
    pixels: pixels.map((row) =>
      row.map((cell) => ({
        key: cell.key,
        color: cell.color,
        transparent: cell.isExternal ?? false,
      }))
    ),
    colorStats: stats,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}
