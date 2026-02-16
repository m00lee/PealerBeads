// ============================================================
// PealerBeads – Smart Background Removal
// ============================================================
// Provides:
//   1. AI-powered removal via @imgly/background-removal
//   2. Algorithmic fallback: edge-based flood fill
//   3. Magic wand selection (contiguous & global)
//   4. Manual mask painting helpers
// ============================================================

import { removeBackground } from '@imgly/background-removal';

// ---- Types ----

export type CutoutMode = 'ai' | 'auto' | 'magicWand' | 'brushErase' | 'brushRestore';

export interface CutoutState {
  /** The mask – true = visible (foreground), false = removed (background) */
  mask: boolean[][];
  width: number;
  height: number;
}

// ---- AI Background Removal ----

/**
 * Use @imgly/background-removal (ONNX model) to remove the background.
 * Returns an ImageData with transparent background.
 */
export async function aiRemoveBackground(
  imageSource: string | Blob,
  onProgress?: (progress: number) => void,
): Promise<ImageData> {
  const blob = await removeBackground(imageSource, {
    publicPath: `${window.location.origin}/bg-removal-data/`,
    model: 'isnet_quint8',
    progress: (key: string, current: number, total: number) => {
      if (onProgress && total > 0) {
        onProgress(current / total);
      }
    },
  });

  // Convert blob to ImageData
  const url = URL.createObjectURL(blob);
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = url;
  });
  URL.revokeObjectURL(url);

  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, img.width, img.height);
}

/**
 * Extract boolean mask from ImageData alpha channel
 */
export function imageDataToMask(imageData: ImageData): CutoutState {
  const { width, height, data } = imageData;
  const mask: boolean[][] = [];
  for (let y = 0; y < height; y++) {
    const row: boolean[] = [];
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      row.push(data[idx + 3] > 128); // alpha > 128 → foreground
    }
    mask.push(row);
  }
  return { mask, width, height };
}

// ---- Algorithmic Background Removal (Edge Flood Fill) ----

/**
 * Automatically detect and remove background by:
 * 1. Sampling border pixels to find dominant background color(s)
 * 2. Flood-filling from edges with color tolerance
 * Returns a boolean mask (true = keep, false = remove)
 */
export function autoRemoveBackground(
  imageData: ImageData,
  tolerance: number = 30,
): CutoutState {
  const { width, height, data } = imageData;

  // Step 1: Sample border pixels and find dominant background colors
  const borderColors: [number, number, number][] = [];
  const addBorder = (x: number, y: number) => {
    const idx = (y * width + x) * 4;
    if (data[idx + 3] > 128) { // skip fully transparent
      borderColors.push([data[idx], data[idx + 1], data[idx + 2]]);
    }
  };

  // Sample all 4 edges
  for (let x = 0; x < width; x++) {
    addBorder(x, 0);
    addBorder(x, height - 1);
  }
  for (let y = 1; y < height - 1; y++) {
    addBorder(0, y);
    addBorder(width - 1, y);
  }

  if (borderColors.length === 0) {
    // All borders transparent – nothing to remove
    return {
      mask: Array.from({ length: height }, () => Array(width).fill(true)),
      width,
      height,
    };
  }

  // Find dominant color(s) using simple clustering
  const bgColors = findDominantColors(borderColors, 3);

  // Step 2: BFS flood fill from all edge pixels
  const visited = new Uint8Array(width * height); // 0 = unvisited, 1 = background, 2 = foreground
  const queue: number[] = [];

  // Seed: all edge pixels that match background color
  const isBackground = (x: number, y: number): boolean => {
    const idx = (y * width + x) * 4;
    const r = data[idx], g = data[idx + 1], b = data[idx + 2], a = data[idx + 3];
    if (a < 128) return true; // transparent = background
    return bgColors.some(([br, bg, bb]) => colorDistance(r, g, b, br, bg, bb) < tolerance);
  };

  // Seed edges
  for (let x = 0; x < width; x++) {
    for (const y of [0, height - 1]) {
      if (isBackground(x, y)) {
        const key = y * width + x;
        if (!visited[key]) {
          visited[key] = 1;
          queue.push(key);
        }
      }
    }
  }
  for (let y = 1; y < height - 1; y++) {
    for (const x of [0, width - 1]) {
      if (isBackground(x, y)) {
        const key = y * width + x;
        if (!visited[key]) {
          visited[key] = 1;
          queue.push(key);
        }
      }
    }
  }

  // BFS
  let head = 0;
  while (head < queue.length) {
    const key = queue[head++];
    const x = key % width;
    const y = (key - x) / width;

    const neighbors = [
      [x - 1, y], [x + 1, y],
      [x, y - 1], [x, y + 1],
    ];

    for (const [nx, ny] of neighbors) {
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const nk = ny * width + nx;
      if (visited[nk]) continue;
      if (isBackground(nx, ny)) {
        visited[nk] = 1;
        queue.push(nk);
      } else {
        visited[nk] = 2;
      }
    }
  }

  // Build mask
  const mask: boolean[][] = [];
  for (let y = 0; y < height; y++) {
    const row: boolean[] = [];
    for (let x = 0; x < width; x++) {
      row.push(visited[y * width + x] !== 1);
    }
    mask.push(row);
  }

  return { mask, width, height };
}

// ---- Magic Wand Tool ----

/**
 * Select contiguous region of similar color starting from (sx, sy)
 */
export function magicWandContiguous(
  imageData: ImageData,
  sx: number,
  sy: number,
  tolerance: number = 30,
): boolean[][] {
  const { width, height, data } = imageData;
  const selection: boolean[][] = Array.from({ length: height }, () => Array(width).fill(false));

  const idx = (sy * width + sx) * 4;
  const tr = data[idx], tg = data[idx + 1], tb = data[idx + 2];

  const visited = new Uint8Array(width * height);
  const queue: number[] = [sy * width + sx];
  visited[sy * width + sx] = 1;
  selection[sy][sx] = true;

  let head = 0;
  while (head < queue.length) {
    const key = queue[head++];
    const x = key % width;
    const y = (key - x) / width;

    const neighbors = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]];
    for (const [nx, ny] of neighbors) {
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const nk = ny * width + nx;
      if (visited[nk]) continue;
      visited[nk] = 1;

      const ni = nk * 4;
      if (colorDistance(data[ni], data[ni + 1], data[ni + 2], tr, tg, tb) <= tolerance) {
        selection[ny][nx] = true;
        queue.push(nk);
      }
    }
  }

  return selection;
}

/**
 * Select all pixels of similar color globally (non-contiguous)
 */
export function magicWandGlobal(
  imageData: ImageData,
  sx: number,
  sy: number,
  tolerance: number = 30,
): boolean[][] {
  const { width, height, data } = imageData;
  const idx = (sy * width + sx) * 4;
  const tr = data[idx], tg = data[idx + 1], tb = data[idx + 2];

  const selection: boolean[][] = [];
  for (let y = 0; y < height; y++) {
    const row: boolean[] = [];
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      row.push(colorDistance(data[i], data[i + 1], data[i + 2], tr, tg, tb) <= tolerance);
    }
    selection.push(row);
  }

  return selection;
}

// ---- Mask Operations ----

/**
 * Apply mask to ImageData – set transparent where mask is false
 */
export function applyMaskToImageData(imageData: ImageData, mask: boolean[][]): ImageData {
  const { width, height } = imageData;
  const result = new ImageData(new Uint8ClampedArray(imageData.data), width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!mask[y]?.[x]) {
        const idx = (y * width + x) * 4;
        result.data[idx + 3] = 0; // fully transparent
      }
    }
  }
  return result;
}

/**
 * Merge selection into existing mask
 * mode = 'remove': selected areas become hidden (false)
 * mode = 'restore': selected areas become visible (true)
 */
export function mergeSelection(
  mask: boolean[][],
  selection: boolean[][],
  mode: 'remove' | 'restore',
): boolean[][] {
  const height = mask.length;
  const width = mask[0]?.length ?? 0;
  const result = mask.map((row) => [...row]);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (selection[y]?.[x]) {
        result[y][x] = mode === 'restore';
      }
    }
  }
  return result;
}

/**
 * Paint a circular brush stroke on the mask
 */
export function paintMaskBrush(
  mask: boolean[][],
  cx: number,
  cy: number,
  radius: number,
  value: boolean,
): boolean[][] {
  const height = mask.length;
  const width = mask[0]?.length ?? 0;
  const result = mask.map((row) => [...row]);
  const r2 = radius * radius;
  for (let y = Math.max(0, cy - radius); y <= Math.min(height - 1, cy + radius); y++) {
    for (let x = Math.max(0, cx - radius); x <= Math.min(width - 1, cx + radius); x++) {
      if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r2) {
        result[y][x] = value;
      }
    }
  }
  return result;
}

/**
 * Refine mask edges – morphological erode/dilate
 */
export function refineMask(
  mask: boolean[][],
  operation: 'erode' | 'dilate',
  radius: number = 1,
): boolean[][] {
  const height = mask.length;
  const width = mask[0]?.length ?? 0;
  const result = mask.map((row) => [...row]);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let found = false;
      outer:
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const ny = y + dy, nx = x + dx;
          if (ny < 0 || ny >= height || nx < 0 || nx >= width) continue;
          if (operation === 'erode' && !mask[ny][nx]) {
            found = true;
            break outer;
          }
          if (operation === 'dilate' && mask[ny][nx]) {
            found = true;
            break outer;
          }
        }
      }
      if (operation === 'erode' && found) result[y][x] = false;
      if (operation === 'dilate' && found) result[y][x] = true;
    }
  }

  return result;
}

/**
 * Feather (smooth) mask edges for a softer cutout.
 * Returns an alpha map (0-255) instead of boolean for smoother blending.
 */
export function featherMask(
  mask: boolean[][],
  radius: number = 2,
): number[][] {
  const height = mask.length;
  const width = mask[0]?.length ?? 0;
  const alpha: number[][] = mask.map((row) => row.map((v) => (v ? 255 : 0)));

  // Simple box blur of alpha
  const temp: number[][] = alpha.map((row) => [...row]);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0, count = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const ny = y + dy, nx = x + dx;
          if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
            sum += alpha[ny][nx];
            count++;
          }
        }
      }
      temp[y][x] = Math.round(sum / count);
    }
  }

  return temp;
}

/**
 * Apply alpha map to ImageData (for feathered edges)
 */
export function applyAlphaMap(imageData: ImageData, alphaMap: number[][]): ImageData {
  const { width, height } = imageData;
  const result = new ImageData(new Uint8ClampedArray(imageData.data), width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const origAlpha = result.data[idx + 3];
      result.data[idx + 3] = Math.min(origAlpha, alphaMap[y]?.[x] ?? 255);
    }
  }
  return result;
}

// ---- Helpers ----

/** Euclidean color distance in RGB space */
function colorDistance(
  r1: number, g1: number, b1: number,
  r2: number, g2: number, b2: number,
): number {
  // Use Redmean-weighted distance for better perceptual accuracy
  const rMean = (r1 + r2) / 2;
  const dr = r1 - r2, dg = g1 - g2, db = b1 - b2;
  return Math.sqrt(
    (2 + rMean / 256) * dr * dr +
    4 * dg * dg +
    (2 + (255 - rMean) / 256) * db * db
  );
}

/**
 * Find up to `k` dominant colors from a list using simple K-means-like clustering
 */
function findDominantColors(
  colors: [number, number, number][],
  k: number = 3,
): [number, number, number][] {
  if (colors.length === 0) return [];
  if (colors.length <= k) return [...colors];

  // Initialize centroids by picking evenly spaced samples
  const step = Math.floor(colors.length / k);
  const centroids: [number, number, number][] = [];
  for (let i = 0; i < k; i++) {
    centroids.push([...colors[i * step]]);
  }

  // Run 5 iterations of K-means
  for (let iter = 0; iter < 5; iter++) {
    const clusters: [number, number, number][][] = centroids.map(() => []);

    // Assign each color to nearest centroid
    for (const c of colors) {
      let minD = Infinity, minI = 0;
      for (let i = 0; i < centroids.length; i++) {
        const d = colorDistance(c[0], c[1], c[2], centroids[i][0], centroids[i][1], centroids[i][2]);
        if (d < minD) { minD = d; minI = i; }
      }
      clusters[minI].push(c);
    }

    // Update centroids
    for (let i = 0; i < centroids.length; i++) {
      if (clusters[i].length === 0) continue;
      let sr = 0, sg = 0, sb = 0;
      for (const c of clusters[i]) {
        sr += c[0]; sg += c[1]; sb += c[2];
      }
      const n = clusters[i].length;
      centroids[i] = [Math.round(sr / n), Math.round(sg / n), Math.round(sb / n)];
    }
  }

  // Return only centroids that had significant cluster membership
  return centroids;
}

/**
 * Create initial full mask (all visible)
 */
export function createFullMask(width: number, height: number): boolean[][] {
  return Array.from({ length: height }, () => Array(width).fill(true));
}

/**
 * Invert mask
 */
export function invertMask(mask: boolean[][]): boolean[][] {
  return mask.map((row) => row.map((v) => !v));
}
