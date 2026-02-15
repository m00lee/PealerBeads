// ============================================================
// PealerBeads – Pixel Editing Operations
// ============================================================

import type { MappedPixel, GridDimensions } from '@/types';

export const TRANSPARENT_KEY = 'ERASE';

export const transparentPixel: MappedPixel = {
  key: TRANSPARENT_KEY,
  color: '#FFFFFF',
  isExternal: true,
};

/** Flood-fill erase: replaces all connected cells matching `targetKey` with transparent */
export function floodFillErase(
  pixels: MappedPixel[][],
  dims: GridDimensions,
  startRow: number,
  startCol: number,
  targetKey: string
): MappedPixel[][] {
  const { N, M } = dims;
  const next = pixels.map((r) => r.map((c) => ({ ...c })));
  const visited = Array.from({ length: M }, () => new Uint8Array(N));
  const stack = [{ row: startRow, col: startCol }];

  while (stack.length) {
    const { row, col } = stack.pop()!;
    if (row < 0 || row >= M || col < 0 || col >= N || visited[row][col]) continue;
    const cell = next[row][col];
    if (!cell || cell.isExternal || cell.key !== targetKey) continue;
    visited[row][col] = 1;
    next[row][col] = { ...transparentPixel };
    stack.push(
      { row: row - 1, col },
      { row: row + 1, col },
      { row, col: col - 1 },
      { row, col: col + 1 }
    );
  }
  return next;
}

/** Flood-fill paint: fills all connected cells matching the color at (startRow,startCol) */
export function floodFill(
  pixels: MappedPixel[][],
  dims: GridDimensions,
  startRow: number,
  startCol: number,
  fillValue: MappedPixel
): MappedPixel[][] {
  const { N, M } = dims;
  const startCell = pixels[startRow]?.[startCol];
  if (!startCell) return pixels;

  const targetColor = startCell.color;
  const targetExternal = startCell.isExternal ?? false;

  // If fill color is same as target, no-op
  if (fillValue.color === targetColor && (fillValue.isExternal ?? false) === targetExternal) {
    return pixels;
  }

  const next = pixels.map((r) => r.map((c) => ({ ...c })));
  const visited = Array.from({ length: M }, () => new Uint8Array(N));
  const stack = [{ row: startRow, col: startCol }];

  while (stack.length) {
    const { row, col } = stack.pop()!;
    if (row < 0 || row >= M || col < 0 || col >= N || visited[row][col]) continue;
    const cell = next[row][col];
    if (!cell) continue;
    if (cell.color !== targetColor || (cell.isExternal ?? false) !== targetExternal) continue;

    visited[row][col] = 1;
    next[row][col] = { ...fillValue };
    stack.push(
      { row: row - 1, col },
      { row: row + 1, col },
      { row, col: col - 1 },
      { row, col: col + 1 }
    );
  }
  return next;
}

/** Replace all occurrences of one color with another — structural sharing */
export function replaceColor(
  pixels: MappedPixel[][],
  dims: GridDimensions,
  sourceHex: string,
  target: MappedPixel
): { newPixels: MappedPixel[][]; count: number } {
  const { N, M } = dims;
  const next = [...pixels]; // shallow copy outer array
  let count = 0;
  const srcUpper = sourceHex.toUpperCase();

  for (let j = 0; j < M; j++) {
    let rowCopied = false;
    for (let i = 0; i < N; i++) {
      const cell = next[j][i];
      if (cell && !cell.isExternal && cell.color.toUpperCase() === srcUpper) {
        if (!rowCopied) {
          next[j] = next[j].map(c => ({ ...c }));
          rowCopied = true;
        }
        next[j][i] = { ...target, isExternal: false };
        count++;
      }
    }
  }
  return { newPixels: next, count };
}

/** Paint a single pixel — structural sharing: only copy the affected row */
export function paintPixel(
  pixels: MappedPixel[][],
  row: number,
  col: number,
  value: MappedPixel
): MappedPixel[][] | null {
  const cell = pixels[row]?.[col];
  if (!cell) return null;
  if (cell.key === value.key && cell.color === value.color && cell.isExternal === value.isExternal) {
    return null; // no change
  }
  const next = [...pixels];
  next[row] = [...pixels[row]];
  next[row][col] = { ...value };
  return next;
}

/** Recalculate color statistics */
export function recalcColorStats(
  pixels: MappedPixel[][]
): { counts: Record<string, { count: number; color: string; key: string }>; total: number } {
  const counts: Record<string, { count: number; color: string; key: string }> = {};
  let total = 0;
  for (const row of pixels) {
    for (const cell of row) {
      if (cell && !cell.isExternal && cell.key !== TRANSPARENT_KEY) {
        const hex = cell.color.toUpperCase();
        if (!counts[hex]) counts[hex] = { count: 0, color: hex, key: cell.key };
        counts[hex].count++;
        total++;
      }
    }
  }
  return { counts, total };
}

// ---- Shape drawing algorithms ----

/** Bresenham's line: returns all cells from (c0,r0) to (c1,r1) */
export function linePixels(
  c0: number, r0: number, c1: number, r1: number
): { col: number; row: number }[] {
  const result: { col: number; row: number }[] = [];
  let x0 = c0, y0 = r0, x1 = c1, y1 = r1;
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  while (true) {
    result.push({ col: x0, row: y0 });
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x0 += sx; }
    if (e2 < dx) { err += dx; y0 += sy; }
  }
  return result;
}

/** Rectangle outline: returns all cells on the border of the rectangle */
export function rectPixels(
  c0: number, r0: number, c1: number, r1: number, filled: boolean
): { col: number; row: number }[] {
  const minC = Math.min(c0, c1);
  const maxC = Math.max(c0, c1);
  const minR = Math.min(r0, r1);
  const maxR = Math.max(r0, r1);
  const result: { col: number; row: number }[] = [];

  for (let r = minR; r <= maxR; r++) {
    for (let c = minC; c <= maxC; c++) {
      if (filled || r === minR || r === maxR || c === minC || c === maxC) {
        result.push({ col: c, row: r });
      }
    }
  }
  return result;
}

/** Circle (midpoint algorithm): returns cells on the circle outline or filled */
export function circlePixels(
  cx: number, cy: number, radius: number, filled: boolean
): { col: number; row: number }[] {
  const result: { col: number; row: number }[] = [];
  const seen = new Set<string>();
  const add = (col: number, row: number) => {
    const key = `${col},${row}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push({ col, row });
    }
  };

  if (radius <= 0) {
    add(cx, cy);
    return result;
  }

  if (filled) {
    for (let r = -radius; r <= radius; r++) {
      for (let c = -radius; c <= radius; c++) {
        if (c * c + r * r <= radius * radius) {
          add(cx + c, cy + r);
        }
      }
    }
  } else {
    // Midpoint circle algorithm
    let x = radius, y = 0;
    let d = 1 - radius;

    const plotOctants = (px: number, py: number) => {
      add(cx + px, cy + py);
      add(cx - px, cy + py);
      add(cx + px, cy - py);
      add(cx - px, cy - py);
      add(cx + py, cy + px);
      add(cx - py, cy + px);
      add(cx + py, cy - px);
      add(cx - py, cy - px);
    };

    plotOctants(x, y);
    while (x > y) {
      y++;
      if (d <= 0) {
        d += 2 * y + 1;
      } else {
        x--;
        d += 2 * (y - x) + 1;
      }
      plotOctants(x, y);
    }
  }
  return result;
}

/** Paint multiple cells at once — structural sharing */
export function paintCells(
  pixels: MappedPixel[][],
  dims: GridDimensions,
  cells: { col: number; row: number }[],
  value: MappedPixel,
): MappedPixel[][] {
  const { N, M } = dims;
  let next = pixels;
  let copied = false;
  const rowsCopied = new Set<number>();

  for (const { col, row } of cells) {
    if (row < 0 || row >= M || col < 0 || col >= N) continue;
    const existing = (copied ? next : pixels)[row]?.[col];
    if (existing && existing.key === value.key && existing.color === value.color) continue;

    if (!copied) {
      next = [...pixels];
      copied = true;
    }
    if (!rowsCopied.has(row)) {
      next[row] = [...next[row]];
      rowsCopied.add(row);
    }
    next[row][col] = { ...value };
  }
  return next;
}
