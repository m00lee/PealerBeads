// ============================================================
// PealerBeads – Color Optimization (相近色合并)
// ============================================================
//
// Reduces the number of distinct bead colors in a pixel grid
// by merging the most similar colors together, re-mapping pixels
// to the surviving color. Uses perceptual distance (redmean).
//
// Algorithm:
//   1. Collect color usage stats from the grid
//   2. Build a pairwise distance matrix between all used colors
//   3. Greedily merge the two closest colors (re-map the lower-count
//      one to the higher-count one) until target count is reached
//   4. Return a new pixel grid with merged colors applied

import type { MappedPixel, PaletteColor, RgbColor, GridDimensions } from '@/types';
import { TRANSPARENT_KEY } from './pixelEditing';
import { perceptualDistance, hexToRgb } from './pixelation';

// ---- Types ----

export interface ColorUsage {
  hex: string;       // e.g. "#FAF4C8"
  key: string;       // e.g. "A01"
  rgb: RgbColor;
  count: number;
}

export interface MergeResult {
  /** Mapping from old hex → new hex for changed colors */
  mergeMap: Map<string, string>;
  /** Mapping from old hex → new key */
  mergeKeyMap: Map<string, string>;
  /** How many colors were merged */
  mergedCount: number;
  /** Colors before/after */
  colorsBefore: number;
  colorsAfter: number;
}

// ---- Collect color usage from pixel grid ----

export function collectColorUsage(pixels: MappedPixel[][]): ColorUsage[] {
  const map = new Map<string, ColorUsage>();
  for (const row of pixels) {
    for (const cell of row) {
      if (!cell || cell.isExternal || cell.key === TRANSPARENT_KEY) continue;
      const hex = cell.color.toUpperCase();
      const existing = map.get(hex);
      if (existing) {
        existing.count++;
      } else {
        const rgb = hexToRgb(hex);
        if (rgb) {
          map.set(hex, { hex, key: cell.key, rgb, count: 1 });
        }
      }
    }
  }
  return Array.from(map.values());
}

// ---- Build merge plan ----

/**
 * Calculate which colors to merge to reach targetCount.
 * Greedy: always merge the pair with smallest perceptual distance.
 * The color with fewer beads is absorbed into the more popular one.
 */
export function calculateMergePlan(
  usage: ColorUsage[],
  targetCount: number
): MergeResult {
  if (usage.length <= targetCount) {
    return {
      mergeMap: new Map(),
      mergeKeyMap: new Map(),
      mergedCount: 0,
      colorsBefore: usage.length,
      colorsAfter: usage.length,
    };
  }

  // Work with clones so we don't mutate input
  const active = usage.map((u) => ({ ...u }));
  const mergeMap = new Map<string, string>();   // old hex → replacement hex
  const mergeKeyMap = new Map<string, string>(); // old hex → replacement key

  while (active.length > targetCount) {
    // Find the two closest colors
    let minDist = Infinity;
    let mergeA = 0;
    let mergeB = 1;

    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const d = perceptualDistance(active[i].rgb, active[j].rgb);
        if (d < minDist) {
          minDist = d;
          mergeA = i;
          mergeB = j;
        }
      }
    }

    // Merge: the one with fewer beads gets absorbed
    let survivor: number, victim: number;
    if (active[mergeA].count >= active[mergeB].count) {
      survivor = mergeA;
      victim = mergeB;
    } else {
      survivor = mergeB;
      victim = mergeA;
    }

    // Record this merge
    mergeMap.set(active[victim].hex, active[survivor].hex);
    mergeKeyMap.set(active[victim].hex, active[survivor].key);

    // Also update any previous merges that pointed to the victim
    for (const [oldHex, targetHex] of mergeMap.entries()) {
      if (targetHex === active[victim].hex) {
        mergeMap.set(oldHex, active[survivor].hex);
        mergeKeyMap.set(oldHex, active[survivor].key);
      }
    }

    // Add victim's count to survivor
    active[survivor].count += active[victim].count;

    // Remove victim
    active.splice(victim > survivor ? victim : victim, 1);
    // Fix index if survivor was after victim
    // (splice above already handles this correctly since we remove by index)
  }

  return {
    mergeMap,
    mergeKeyMap,
    mergedCount: mergeMap.size,
    colorsBefore: usage.length,
    colorsAfter: active.length,
  };
}

// ---- Apply merge to pixel grid ----

/**
 * Create a new pixel grid with merged colors applied.
 * Uses structural sharing — only copies rows that changed.
 */
export function applyColorMerge(
  pixels: MappedPixel[][],
  mergeMap: Map<string, string>,
  mergeKeyMap: Map<string, string>
): MappedPixel[][] {
  if (mergeMap.size === 0) return pixels;

  const result: MappedPixel[][] = new Array(pixels.length);
  for (let j = 0; j < pixels.length; j++) {
    let rowChanged = false;
    let newRow: MappedPixel[] | null = null;

    for (let i = 0; i < pixels[j].length; i++) {
      const cell = pixels[j][i];
      if (!cell || cell.isExternal || cell.key === TRANSPARENT_KEY) continue;

      const hex = cell.color.toUpperCase();
      const newHex = mergeMap.get(hex);
      if (newHex) {
        if (!rowChanged) {
          newRow = [...pixels[j]];
          rowChanged = true;
        }
        newRow![i] = {
          key: mergeKeyMap.get(hex) ?? cell.key,
          color: newHex,
          isExternal: false,
        };
      }
    }

    result[j] = rowChanged ? newRow! : pixels[j];
  }

  return result;
}

// ---- Convenience: reduce colors in one call ----

export function optimizeColors(
  pixels: MappedPixel[][],
  targetCount: number
): { newPixels: MappedPixel[][]; result: MergeResult } {
  const usage = collectColorUsage(pixels);
  const result = calculateMergePlan(usage, targetCount);
  const newPixels = applyColorMerge(pixels, result.mergeMap, result.mergeKeyMap);
  return { newPixels, result };
}

// ---- Get merge preview (which colors would merge into which) ----

export interface MergePreviewItem {
  fromHex: string;
  fromKey: string;
  fromCount: number;
  toHex: string;
  toKey: string;
  distance: number;
}

export function getMergePreview(
  usage: ColorUsage[],
  targetCount: number
): MergePreviewItem[] {
  if (usage.length <= targetCount) return [];

  const active = usage.map((u) => ({ ...u }));
  const previews: MergePreviewItem[] = [];

  while (active.length > targetCount) {
    let minDist = Infinity;
    let mergeA = 0;
    let mergeB = 1;

    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const d = perceptualDistance(active[i].rgb, active[j].rgb);
        if (d < minDist) {
          minDist = d;
          mergeA = i;
          mergeB = j;
        }
      }
    }

    let survivor: number, victim: number;
    if (active[mergeA].count >= active[mergeB].count) {
      survivor = mergeA;
      victim = mergeB;
    } else {
      survivor = mergeB;
      victim = mergeA;
    }

    previews.push({
      fromHex: active[victim].hex,
      fromKey: active[victim].key,
      fromCount: active[victim].count,
      toHex: active[survivor].hex,
      toKey: active[survivor].key,
      distance: minDist,
    });

    active[survivor].count += active[victim].count;
    active.splice(victim > survivor ? victim : victim, 1);
  }

  return previews;
}
