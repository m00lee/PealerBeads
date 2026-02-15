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

/** Pre-computed pointy-top hexagon vertex offsets (unit size = 1) */
const HEX_OFFSETS: { dx: number; dy: number }[] = (() => {
  const offsets: { dx: number; dy: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    offsets.push({ dx: Math.cos(angle), dy: Math.sin(angle) });
  }
  return offsets;
})();

/** Draw a pointy-top hexagon path (uses pre-computed offsets) */
export function drawHexPath(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number
) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const x = cx + size * HEX_OFFSETS[i].dx;
    const y = cy + size * HEX_OFFSETS[i].dy;
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

// ---- Bead Rendering Helpers ----

/** Parse hex color to {r,g,b} (0-255) */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}

/** Lighten a color by a factor (0-1), return hex */
function lightenColor(hex: string, factor: number): string {
  const { r, g, b } = hexToRgb(hex);
  const lr = Math.min(255, Math.round(r + (255 - r) * factor));
  const lg = Math.min(255, Math.round(g + (255 - g) * factor));
  const lb = Math.min(255, Math.round(b + (255 - b) * factor));
  return `rgb(${lr},${lg},${lb})`;
}

/** Darken a color by a factor (0-1), return css string */
function darkenColor(hex: string, factor: number): string {
  const { r, g, b } = hexToRgb(hex);
  const dr = Math.round(r * (1 - factor));
  const dg = Math.round(g * (1 - factor));
  const db = Math.round(b * (1 - factor));
  return `rgb(${dr},${dg},${db})`;
}

/**
 * Draw a single bead (top-down view of a hollow cylinder):
 * - Outer ring: lighter shade
 * - Inner circle: darker shade (the color "center")
 * - Small hole in the very center
 */
export function drawBead(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  color: string
) {
  const outerR = radius * 0.92;
  const innerR = radius * 0.55;
  const holeR = radius * 0.12;

  // Outer ring (lighter shade)
  ctx.beginPath();
  ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
  ctx.fillStyle = lightenColor(color, 0.35);
  ctx.fill();

  // Inner circle (the actual bead color, darker)
  ctx.beginPath();
  ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
  ctx.fillStyle = darkenColor(color, 0.15);
  ctx.fill();

  // Central hole
  ctx.beginPath();
  ctx.arc(cx, cy, holeR, 0, Math.PI * 2);
  ctx.fillStyle = '#1a1a2e';
  ctx.fill();

  // Subtle 3D highlight on outer ring
  const grad = ctx.createRadialGradient(
    cx - outerR * 0.3, cy - outerR * 0.3, 0,
    cx, cy, outerR
  );
  grad.addColorStop(0, 'rgba(255,255,255,0.25)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.1)');
  ctx.beginPath();
  ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  // Thin outline
  ctx.beginPath();
  ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
  ctx.strokeStyle = darkenColor(color, 0.35);
  ctx.lineWidth = 0.5;
  ctx.stroke();
}
