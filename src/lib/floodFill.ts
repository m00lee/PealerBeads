// ============================================================
// PealerBeads – Flood Fill (Connected Region) Utilities
// ============================================================

import type { MappedPixel } from '@/types';

/** Get all cells connected to (startRow, startCol) with the same color */
export function getConnectedRegion(
  pixels: MappedPixel[][],
  startRow: number,
  startCol: number,
  targetColor: string
): { row: number; col: number }[] {
  const cell = pixels[startRow]?.[startCol];
  if (!cell) return [];

  const M = pixels.length;
  const N = pixels[0].length;
  const visited = Array.from({ length: M }, () => new Uint8Array(N));
  const region: { row: number; col: number }[] = [];
  const stack = [{ row: startRow, col: startCol }];

  while (stack.length > 0) {
    const { row, col } = stack.pop()!;
    if (row < 0 || row >= M || col < 0 || col >= N || visited[row][col]) continue;
    const c = pixels[row][col];
    if (!c || c.isExternal || c.color !== targetColor) continue;

    visited[row][col] = 1;
    region.push({ row, col });
    stack.push(
      { row: row - 1, col },
      { row: row + 1, col },
      { row, col: col - 1 },
      { row, col: col + 1 }
    );
  }
  return region;
}

/** Get the center of a region (for sorting/display) */
export function regionCenter(region: { row: number; col: number }[]): { row: number; col: number } {
  if (!region.length) return { row: 0, col: 0 };
  const tr = region.reduce((s, c) => s + c.row, 0);
  const tc = region.reduce((s, c) => s + c.col, 0);
  return { row: Math.floor(tr / region.length), col: Math.floor(tc / region.length) };
}
