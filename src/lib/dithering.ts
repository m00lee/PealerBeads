// ============================================================
// PealerBeads – Dithering Algorithms
// ============================================================

import type { RgbColor, PaletteColor } from '@/types';
import { findClosestPaletteColor, hexToRgb } from './pixelation';

/**
 * Floyd–Steinberg dithering applied to a pixel buffer.
 * Operates in-place on an ImageData-like structure and returns
 * the quantized result as an array of PaletteColor references.
 */
export function floydSteinbergDither(
  imageData: ImageData,
  width: number,
  height: number,
  palette: PaletteColor[],
  strength: number = 1.0
): PaletteColor[][] {
  // Clone data to avoid mutating input
  const data = new Float32Array(imageData.data.length);
  for (let i = 0; i < imageData.data.length; i++) data[i] = imageData.data[i];

  const result: PaletteColor[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => palette[0])
  );

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      if (data[idx + 3] < 128) continue; // skip transparent

      const oldR = data[idx];
      const oldG = data[idx + 1];
      const oldB = data[idx + 2];

      const closest = findClosestPaletteColor(
        { r: Math.round(oldR), g: Math.round(oldG), b: Math.round(oldB) },
        palette
      );
      result[y][x] = closest;

      // Quantization error
      const errR = (oldR - closest.rgb.r) * strength;
      const errG = (oldG - closest.rgb.g) * strength;
      const errB = (oldB - closest.rgb.b) * strength;

      // Distribute error to neighbors
      const distribute = (dx: number, dy: number, factor: number) => {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const ni = (ny * width + nx) * 4;
          data[ni] += errR * factor;
          data[ni + 1] += errG * factor;
          data[ni + 2] += errB * factor;
        }
      };

      distribute(1, 0, 7 / 16);
      distribute(-1, 1, 3 / 16);
      distribute(0, 1, 5 / 16);
      distribute(1, 1, 1 / 16);
    }
  }

  return result;
}

/**
 * Bayer matrix (ordered) dithering.
 * Less diffusion than F-S but more structured; good for pixel art.
 */
export function bayerDither(
  imageData: ImageData,
  width: number,
  height: number,
  palette: PaletteColor[],
  strength: number = 1.0
): PaletteColor[][] {
  // 4×4 Bayer matrix normalized to [-0.5, 0.5]
  const bayer4 = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5],
  ].map((row) => row.map((v) => (v / 16 - 0.5) * strength * 64));

  const data = imageData.data;
  const result: PaletteColor[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => palette[0])
  );

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      if (data[idx + 3] < 128) continue;

      const bayerVal = bayer4[y % 4][x % 4];
      const r = Math.max(0, Math.min(255, data[idx] + bayerVal));
      const g = Math.max(0, Math.min(255, data[idx + 1] + bayerVal));
      const b = Math.max(0, Math.min(255, data[idx + 2] + bayerVal));

      result[y][x] = findClosestPaletteColor({ r: Math.round(r), g: Math.round(g), b: Math.round(b) }, palette);
    }
  }

  return result;
}
