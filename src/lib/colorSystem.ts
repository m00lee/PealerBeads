// ============================================================
// PealerBeads – Color System Utilities
// ============================================================

import type { PaletteColor, ColorSystem, RgbColor } from '@/types';
import colorSystemMapping from '@/data/colorSystemMapping.json';

export const colorSystemOptions: { key: ColorSystem; name: string }[] = [
  { key: 'MARD', name: 'MARD' },
  { key: 'COCO', name: 'COCO' },
  { key: '漫漫', name: '漫漫' },
  { key: '盼盼', name: '盼盼' },
  { key: '咪小窝', name: '咪小窝' },
];

type ColorMapping = Record<string, Record<ColorSystem, string>>;
const mapping = colorSystemMapping as ColorMapping;

function hexToRgb(hex: string): RgbColor {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}

/** Build the full palette for a given color system */
export function buildPalette(system: ColorSystem): PaletteColor[] {
  const palette: PaletteColor[] = [];
  for (const [hex, map] of Object.entries(mapping)) {
    const key = map[system];
    if (key) {
      palette.push({ key, hex: hex.toUpperCase(), rgb: hexToRgb(hex) });
    }
  }
  return palette;
}

/** Get display key for a hex value in a given system */
export function getDisplayKey(hex: string, system: ColorSystem): string {
  const norm = hex.toUpperCase();
  const m = mapping[norm];
  return m?.[system] ?? '?';
}

/** Convert a display key back to hex */
export function keyToHex(displayKey: string, system: ColorSystem): string | null {
  for (const [hex, map] of Object.entries(mapping)) {
    if (map[system] === displayKey) return hex.toUpperCase();
  }
  return null;
}

/** Get all hex values in the mapping */
export function getAllHexValues(): string[] {
  return Object.keys(mapping);
}

/** Sort colors by hue for display (Schwartzian transform: pre-compute HSL) */
export function sortByHue<T extends { hex: string }>(colors: T[]): T[] {
  function toHsl(hex: string) {
    const h = hex.replace('#', '');
    const r = parseInt(h.substring(0, 2), 16) / 255;
    const g = parseInt(h.substring(2, 4), 16) / 255;
    const b = parseInt(h.substring(4, 6), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const diff = max - min;
    const l = (max + min) / 2;
    let s = 0;
    let hue = 0;
    if (diff !== 0) {
      s = l > 0.5 ? diff / (2 - max - min) : diff / (max + min);
      switch (max) {
        case r: hue = ((g - b) / diff + (g < b ? 6 : 0)) / 6; break;
        case g: hue = ((b - r) / diff + 2) / 6; break;
        case b: hue = ((r - g) / diff + 4) / 6; break;
      }
    }
    return { h: hue * 360, s: s * 100, l: l * 100 };
  }

  // Pre-compute HSL values for each color
  const decorated = colors.map((c) => ({ item: c, hsl: toHsl(c.hex) }));
  decorated.sort((a, b) => {
    if (Math.abs(a.hsl.h - b.hsl.h) > 5) return a.hsl.h - b.hsl.h;
    if (Math.abs(a.hsl.l - b.hsl.l) > 3) return b.hsl.l - a.hsl.l;
    return b.hsl.s - a.hsl.s;
  });
  return decorated.map((d) => d.item);
}
