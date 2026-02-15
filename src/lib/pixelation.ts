// ============================================================
// PealerBeads – Pixelation Engine
// ============================================================

import type { RgbColor, PaletteColor, MappedPixel, PixelationMode } from '@/types';
import { transparentPixel } from './pixelEditing';

// ---- Color helpers ----

export function hexToRgb(hex: string): RgbColor | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

export function rgbToHex(r: number, g: number, b: number): string {
  return (
    '#' +
    [r, g, b]
      .map((v) => {
        const h = Math.max(0, Math.min(255, Math.round(v))).toString(16);
        return h.length === 1 ? '0' + h : h;
      })
      .join('')
      .toUpperCase()
  );
}

/** Euclidean distance in RGB space */
export function colorDistance(a: RgbColor, b: RgbColor): number {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/** Weighted perceptual distance (redmean) – better than raw Euclidean */
export function perceptualDistance(a: RgbColor, b: RgbColor): number {
  const rMean = (a.r + b.r) / 2;
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(
    (2 + rMean / 256) * dr * dr +
      4 * dg * dg +
      (2 + (255 - rMean) / 256) * db * db
  );
}

/** Find the palette color closest to target by perceptual distance */
export function findClosestPaletteColor(
  target: RgbColor,
  palette: PaletteColor[]
): PaletteColor {
  if (!palette.length) {
    return { key: 'ERR', hex: '#000000', rgb: { r: 0, g: 0, b: 0 } };
  }
  let best = palette[0];
  let bestDist = Infinity;
  for (const pc of palette) {
    const d = perceptualDistance(target, pc.rgb);
    if (d < bestDist) {
      bestDist = d;
      best = pc;
      if (d === 0) break;
    }
  }
  return best;
}

// ---- Color Lookup Table (CLT) for O(1) approximate nearest-color ----

const CLT_BITS = 5; // quantize each channel to 2^5 = 32 levels
const CLT_SHIFT = 8 - CLT_BITS;
const CLT_SIZE = 1 << CLT_BITS;

let _cltPalette: PaletteColor[] | null = null;
let _cltTable: PaletteColor[] | null = null;

/**
 * Build a 32×32×32 color lookup table for a palette.
 * After building, `findClosestPaletteColorFast` runs in O(1).
 */
export function buildColorLookupTable(palette: PaletteColor[]): void {
  if (_cltPalette === palette && _cltTable) return; // already built
  _cltPalette = palette;
  _cltTable = new Array(CLT_SIZE * CLT_SIZE * CLT_SIZE);
  for (let ri = 0; ri < CLT_SIZE; ri++) {
    const r = (ri << CLT_SHIFT) | ((1 << (CLT_SHIFT - 1)) - 1);
    for (let gi = 0; gi < CLT_SIZE; gi++) {
      const g = (gi << CLT_SHIFT) | ((1 << (CLT_SHIFT - 1)) - 1);
      for (let bi = 0; bi < CLT_SIZE; bi++) {
        const b = (bi << CLT_SHIFT) | ((1 << (CLT_SHIFT - 1)) - 1);
        const idx = (ri * CLT_SIZE + gi) * CLT_SIZE + bi;
        _cltTable[idx] = findClosestPaletteColor({ r, g, b }, palette);
      }
    }
  }
}

/** O(1) nearest palette color using pre-built lookup table */
export function findClosestPaletteColorFast(
  target: RgbColor,
  palette: PaletteColor[]
): PaletteColor {
  if (!_cltTable || _cltPalette !== palette) {
    buildColorLookupTable(palette);
  }
  const ri = target.r >> CLT_SHIFT;
  const gi = target.g >> CLT_SHIFT;
  const bi = target.b >> CLT_SHIFT;
  return _cltTable![(ri * CLT_SIZE + gi) * CLT_SIZE + bi];
}

// ---- Cell representative color ----

function cellRepresentativeColor(
  imageData: ImageData,
  sx: number,
  sy: number,
  w: number,
  h: number,
  mode: PixelationMode
): RgbColor | null {
  const data = imageData.data;
  const imgW = imageData.width;
  let rSum = 0,
    gSum = 0,
    bSum = 0,
    count = 0;
  const freqMap: Record<string, number> = {};
  let domRgb: RgbColor | null = null;
  let maxFreq = 0;

  const endX = sx + w;
  const endY = sy + h;

  for (let y = sy; y < endY; y++) {
    for (let x = sx; x < endX; x++) {
      const idx = (y * imgW + x) * 4;
      if (data[idx + 3] < 128) continue; // skip transparent

      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      count++;

      if (mode === 'average') {
        rSum += r;
        gSum += g;
        bSum += b;
      } else {
        const k = `${r},${g},${b}`;
        freqMap[k] = (freqMap[k] || 0) + 1;
        if (freqMap[k] > maxFreq) {
          maxFreq = freqMap[k];
          domRgb = { r, g, b };
        }
      }
    }
  }

  if (count === 0) return null;
  if (mode === 'average') {
    return {
      r: Math.round(rSum / count),
      g: Math.round(gSum / count),
      b: Math.round(bSum / count),
    };
  }
  return domRgb;
}

// ---- Main pixelation function ----

export function calculatePixelGrid(
  imageData: ImageData,
  imgWidth: number,
  imgHeight: number,
  N: number,
  M: number,
  palette: PaletteColor[],
  mode: PixelationMode,
  fallbackColor: PaletteColor
): MappedPixel[][] {
  const grid: MappedPixel[][] = Array.from({ length: M }, () =>
    Array.from({ length: N }, () => ({
      key: fallbackColor.key,
      color: fallbackColor.hex,
    }))
  );

  const cellW = imgWidth / N;
  const cellH = imgHeight / M;

  for (let j = 0; j < M; j++) {
    for (let i = 0; i < N; i++) {
      const sx = Math.floor(i * cellW);
      const sy = Math.floor(j * cellH);
      const ex = Math.min(imgWidth, Math.ceil((i + 1) * cellW));
      const ey = Math.min(imgHeight, Math.ceil((j + 1) * cellH));
      const w = Math.max(1, ex - sx);
      const h = Math.max(1, ey - sy);

      const rgb = cellRepresentativeColor(imageData, sx, sy, w, h, mode);
      if (rgb) {
        const closest = findClosestPaletteColorFast(rgb, palette);
        grid[j][i] = { key: closest.key, color: closest.hex };
      } else {
        grid[j][i] = { ...transparentPixel };
      }
    }
  }

  return grid;
}
