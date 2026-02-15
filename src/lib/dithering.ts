// ============================================================
// PealerBeads – Dithering Algorithms
// ============================================================

import type { RgbColor, PaletteColor } from '@/types';
import { findClosestPaletteColorFast, buildColorLookupTable } from './pixelation';

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
  // Pre-build fast lookup table
  buildColorLookupTable(palette);

  // Use rolling 2-row buffer instead of cloning the entire image
  const rowBytes = width * 4;
  const data = imageData.data;
  // Current and next row error buffers
  let currErr = new Float32Array(rowBytes);
  let nextErr = new Float32Array(rowBytes);

  const result: PaletteColor[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => palette[0])
  );

  for (let y = 0; y < height; y++) {
    // Reset next row error buffer
    nextErr.fill(0);

    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const ex = x * 4;
      if (data[idx + 3] < 128) continue; // skip transparent

      const oldR = data[idx] + currErr[ex];
      const oldG = data[idx + 1] + currErr[ex + 1];
      const oldB = data[idx + 2] + currErr[ex + 2];

      const closest = findClosestPaletteColorFast(
        {
          r: Math.max(0, Math.min(255, Math.round(oldR))),
          g: Math.max(0, Math.min(255, Math.round(oldG))),
          b: Math.max(0, Math.min(255, Math.round(oldB))),
        },
        palette
      );
      result[y][x] = closest;

      // Quantization error
      const errR = (oldR - closest.rgb.r) * strength;
      const errG = (oldG - closest.rgb.g) * strength;
      const errB = (oldB - closest.rgb.b) * strength;

      // Distribute error to neighbors using rolling buffers
      if (x + 1 < width) {
        const nx = (x + 1) * 4;
        currErr[nx]     += errR * (7 / 16);
        currErr[nx + 1] += errG * (7 / 16);
        currErr[nx + 2] += errB * (7 / 16);
      }
      if (y + 1 < height) {
        if (x > 0) {
          const nx = (x - 1) * 4;
          nextErr[nx]     += errR * (3 / 16);
          nextErr[nx + 1] += errG * (3 / 16);
          nextErr[nx + 2] += errB * (3 / 16);
        }
        {
          nextErr[ex]     += errR * (5 / 16);
          nextErr[ex + 1] += errG * (5 / 16);
          nextErr[ex + 2] += errB * (5 / 16);
        }
        if (x + 1 < width) {
          const nx = (x + 1) * 4;
          nextErr[nx]     += errR * (1 / 16);
          nextErr[nx + 1] += errG * (1 / 16);
          nextErr[nx + 2] += errB * (1 / 16);
        }
      }
    }

    // Swap buffers
    const tmp = currErr;
    currErr = nextErr;
    nextErr = tmp;
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
  // Pre-build fast lookup table
  buildColorLookupTable(palette);

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

      result[y][x] = findClosestPaletteColorFast({ r: Math.round(r), g: Math.round(g), b: Math.round(b) }, palette);
    }
  }

  return result;
}
