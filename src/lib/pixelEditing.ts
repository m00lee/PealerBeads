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

/** Replace all occurrences of one color with another */
export function replaceColor(
  pixels: MappedPixel[][],
  dims: GridDimensions,
  sourceHex: string,
  target: MappedPixel
): { newPixels: MappedPixel[][]; count: number } {
  const { N, M } = dims;
  const next = pixels.map((r) => r.map((c) => ({ ...c })));
  let count = 0;
  const srcUpper = sourceHex.toUpperCase();

  for (let j = 0; j < M; j++) {
    for (let i = 0; i < N; i++) {
      const cell = next[j][i];
      if (cell && !cell.isExternal && cell.color.toUpperCase() === srcUpper) {
        next[j][i] = { ...target, isExternal: false };
        count++;
      }
    }
  }
  return { newPixels: next, count };
}

/** Paint a single pixel */
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
  const next = pixels.map((r) => [...r]);
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
