// ============================================================
// PealerBeads – Canvas Coordinate Utilities
// ============================================================

import type { GridDimensions, GridType } from '@/types';

/** Convert client (mouse) coordinates to grid cell indices for square grids */
export function clientToGrid(
  clientX: number,
  clientY: number,
  canvas: HTMLCanvasElement,
  dims: GridDimensions,
  zoom: number,
  panOffset: { x: number; y: number }
): { col: number; row: number } | null {
  const rect = canvas.getBoundingClientRect();
  // Position relative to canvas element
  const cx = clientX - rect.left;
  const cy = clientY - rect.top;

  // Reverse viewport transform
  const worldX = (cx - panOffset.x) / zoom;
  const worldY = (cy - panOffset.y) / zoom;

  const cellW = canvas.width / dims.N / (canvas.width / rect.width);
  const cellH = canvas.height / dims.M / (canvas.height / rect.height);

  // Simpler: use cell size in world space
  const cellSize = Math.min(rect.width / dims.N, rect.height / dims.M);
  const col = Math.floor(worldX / cellSize);
  const row = Math.floor(worldY / cellSize);

  if (col >= 0 && col < dims.N && row >= 0 && row < dims.M) {
    return { col, row };
  }
  return null;
}

/** Convert client coordinates to hex grid cell (odd-r offset layout) */
export function clientToHexGrid(
  clientX: number,
  clientY: number,
  canvas: HTMLCanvasElement,
  dims: GridDimensions,
  zoom: number,
  panOffset: { x: number; y: number },
  hexSize: number
): { col: number; row: number } | null {
  const rect = canvas.getBoundingClientRect();
  const cx = clientX - rect.left;
  const cy = clientY - rect.top;

  const worldX = (cx - panOffset.x) / zoom;
  const worldY = (cy - panOffset.y) / zoom;

  // Hex spacing (flat-top)
  const w = hexSize * 2;
  const h = Math.sqrt(3) * hexSize;

  const row = Math.floor(worldY / h);
  const isOddRow = row % 2 === 1;
  const offsetX = isOddRow ? hexSize : 0;
  const col = Math.floor((worldX - offsetX) / w);

  if (col >= 0 && col < dims.N && row >= 0 && row < dims.M) {
    return { col, row };
  }
  return null;
}

/** Get the center position of a hex cell (odd-r layout, flat-top) */
export function hexCellCenter(
  col: number,
  row: number,
  hexSize: number
): { x: number; y: number } {
  const w = hexSize * 2;
  const h = Math.sqrt(3) * hexSize;
  const isOddRow = row % 2 === 1;
  const offsetX = isOddRow ? hexSize : 0;
  return {
    x: col * w + hexSize + offsetX,
    y: row * h + h / 2,
  };
}

/** Draw a pointy-top hexagon path */
export function drawHexPath(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number
) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    const x = cx + size * Math.cos(angle);
    const y = cy + size * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/** Check if mouse is being dragged (moved beyond threshold) */
export function isDrag(
  start: { x: number; y: number },
  current: { x: number; y: number },
  threshold = 5
): boolean {
  return (
    Math.abs(current.x - start.x) > threshold ||
    Math.abs(current.y - start.y) > threshold
  );
}
