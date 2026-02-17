// ============================================================
// PealerBeads – Project File Serialization / Deserialization
// ============================================================
//
// File format: .pds
// - formatVersion follows SemVer for forward/backward compat
// - pixels use smart encoding: dense (2D array) or sparse (coordinate list)
// - thumbnail is an embedded base64 PNG for recent-file previews
// ============================================================

import type {
  MappedPixel,
  GridDimensions,
  GridType,
  ColorSystem,
  PaletteColor,
  CanvasMode,
} from '@/types';
import { TRANSPARENT_KEY, transparentPixel } from '@/lib/pixelEditing';
import { buildPalette } from '@/lib/colorSystem';

// ---- Constants ----

export const FORMAT_VERSION = '1.0.0';
export const FILE_EXTENSION = '.pds';
export const FILE_FILTER_NAME = 'PealerBeads 设计文件';

// ---- File Format Types ----

/** Dense pixel encoding: [key, hexColor] tuple, or null for transparent */
type DensePixel = [string, string] | null;

/** Sparse pixel entry */
interface SparsePixelEntry {
  /** row */
  r: number;
  /** col */
  c: number;
  /** color key */
  k: string;
  /** hex color */
  x: string;
}

/** The on-disk JSON structure */
export interface ProjectFileData {
  formatVersion: string;
  appVersion: string;

  meta: {
    name: string;
    createdAt: string;
    updatedAt: string;
    thumbnail?: string; // data:image/png;base64,...
  };

  grid: {
    type: GridType;
    cols: number;
    rows: number;
    canvasMode: CanvasMode;
  };

  palette: {
    colorSystem: ColorSystem;
    maxColors: number;
    lockedColors: string[]; // hex strings
    selectedColorHex: string | null;
  };

  pixels: {
    encoding: 'dense' | 'sparse';
    data: DensePixel[][] | SparsePixelEntry[];
  };
}

/** The subset of store state needed to reconstruct a project */
export interface LoadedProjectState {
  projectName: string;
  gridDimensions: GridDimensions;
  gridType: GridType;
  canvasMode: CanvasMode;
  colorSystem: ColorSystem;
  palette: PaletteColor[];
  selectedColor: PaletteColor | null;
  lockedColors: Set<string>;
  maxColors: number;
  pixels: MappedPixel[][];
}

// ---- Serialization ----

/**
 * Count how many non-transparent pixels exist in the grid.
 */
function countFilledPixels(pixels: MappedPixel[][]): number {
  let count = 0;
  for (const row of pixels) {
    for (const cell of row) {
      if (cell && !cell.isExternal && cell.key !== TRANSPARENT_KEY) {
        count++;
      }
    }
  }
  return count;
}

/**
 * Determine whether to use sparse encoding.
 * Use sparse when filled pixels < 50% of total cells.
 */
function shouldUseSparse(pixels: MappedPixel[][], dims: GridDimensions): boolean {
  const total = dims.N * dims.M;
  if (total === 0) return true;
  const filled = countFilledPixels(pixels);
  return filled / total < 0.5;
}

/**
 * Encode pixels in dense format: 2D array of [key, hex] | null.
 */
function encodeDense(pixels: MappedPixel[][]): DensePixel[][] {
  return pixels.map((row) =>
    row.map((cell) => {
      if (!cell || cell.isExternal || cell.key === TRANSPARENT_KEY) {
        return null;
      }
      return [cell.key, cell.color];
    })
  );
}

/**
 * Encode pixels in sparse format: list of { r, c, k, x }.
 */
function encodeSparse(pixels: MappedPixel[][]): SparsePixelEntry[] {
  const entries: SparsePixelEntry[] = [];
  for (let r = 0; r < pixels.length; r++) {
    const row = pixels[r];
    if (!row) continue;
    for (let c = 0; c < row.length; c++) {
      const cell = row[c];
      if (cell && !cell.isExternal && cell.key !== TRANSPARENT_KEY) {
        entries.push({ r, c, k: cell.key, x: cell.color });
      }
    }
  }
  return entries;
}

/**
 * Generate a small thumbnail from the pixel grid.
 * Returns a data:image/png;base64 string.
 */
export function generateThumbnail(
  pixels: MappedPixel[][],
  dims: GridDimensions,
  maxSize = 64
): string {
  const { N, M } = dims;
  if (N === 0 || M === 0) return '';

  const scale = Math.min(maxSize / N, maxSize / M, 1);
  const w = Math.max(1, Math.round(N * scale));
  const h = Math.max(1, Math.round(M * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // White background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, w, h);

  const cellW = w / N;
  const cellH = h / M;

  for (let r = 0; r < M; r++) {
    for (let c = 0; c < N; c++) {
      const cell = pixels[r]?.[c];
      if (cell && !cell.isExternal && cell.key !== TRANSPARENT_KEY) {
        ctx.fillStyle = cell.color;
        ctx.fillRect(
          Math.floor(c * cellW),
          Math.floor(r * cellH),
          Math.ceil(cellW),
          Math.ceil(cellH)
        );
      }
    }
  }

  return canvas.toDataURL('image/png');
}

/**
 * Serialize the current project state into the file format.
 */
export function serializeProject(state: {
  projectName: string;
  gridDimensions: GridDimensions;
  gridType: GridType;
  canvasMode: CanvasMode;
  colorSystem: ColorSystem;
  selectedColor: PaletteColor | null;
  lockedColors: Set<string>;
  maxColors: number;
  pixels: MappedPixel[][];
  /** If provided, reuse existing createdAt; otherwise use now */
  createdAt?: string;
}): ProjectFileData {
  const now = new Date().toISOString();
  const useSparse = shouldUseSparse(state.pixels, state.gridDimensions);

  return {
    formatVersion: FORMAT_VERSION,
    appVersion: '0.3.0',

    meta: {
      name: state.projectName,
      createdAt: state.createdAt ?? now,
      updatedAt: now,
      thumbnail: generateThumbnail(state.pixels, state.gridDimensions),
    },

    grid: {
      type: state.gridType,
      cols: state.gridDimensions.N,
      rows: state.gridDimensions.M,
      canvasMode: state.canvasMode,
    },

    palette: {
      colorSystem: state.colorSystem,
      maxColors: state.maxColors,
      lockedColors: Array.from(state.lockedColors),
      selectedColorHex: state.selectedColor?.hex ?? null,
    },

    pixels: {
      encoding: useSparse ? 'sparse' : 'dense',
      data: useSparse
        ? encodeSparse(state.pixels)
        : encodeDense(state.pixels),
    },
  };
}

// ---- Deserialization ----

/**
 * Decode dense pixel data back to MappedPixel[][].
 */
function decodeDense(data: DensePixel[][], rows: number, cols: number): MappedPixel[][] {
  const result: MappedPixel[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: MappedPixel[] = [];
    for (let c = 0; c < cols; c++) {
      const cell = data[r]?.[c];
      if (cell && cell.length === 2) {
        row.push({ key: cell[0], color: cell[1], isExternal: false });
      } else {
        row.push({ ...transparentPixel });
      }
    }
    result.push(row);
  }
  return result;
}

/**
 * Decode sparse pixel data back to MappedPixel[][].
 */
function decodeSparse(data: SparsePixelEntry[], rows: number, cols: number): MappedPixel[][] {
  // Initialize with transparent
  const result: MappedPixel[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ ...transparentPixel }))
  );
  for (const entry of data) {
    if (entry.r >= 0 && entry.r < rows && entry.c >= 0 && entry.c < cols) {
      result[entry.r][entry.c] = { key: entry.k, color: entry.x, isExternal: false };
    }
  }
  return result;
}

/**
 * Validate the loaded JSON has the expected structure.
 * Throws descriptive errors on invalid data.
 */
function validateProjectFile(data: unknown): asserts data is ProjectFileData {
  if (!data || typeof data !== 'object') {
    throw new Error('无效的项目文件：不是有效的 JSON 对象');
  }

  const d = data as Record<string, unknown>;

  if (!d.formatVersion || typeof d.formatVersion !== 'string') {
    throw new Error('无效的项目文件：缺少 formatVersion 字段');
  }

  if (!d.meta || typeof d.meta !== 'object') {
    throw new Error('无效的项目文件：缺少 meta 字段');
  }

  if (!d.grid || typeof d.grid !== 'object') {
    throw new Error('无效的项目文件：缺少 grid 字段');
  }

  const grid = d.grid as Record<string, unknown>;
  if (typeof grid.cols !== 'number' || typeof grid.rows !== 'number') {
    throw new Error('无效的项目文件：grid 尺寸无效');
  }
  if (grid.cols <= 0 || grid.rows <= 0 || grid.cols > 500 || grid.rows > 500) {
    throw new Error(`无效的项目文件：网格尺寸超出范围 (${grid.cols}×${grid.rows})`);
  }

  if (!d.pixels || typeof d.pixels !== 'object') {
    throw new Error('无效的项目文件：缺少 pixels 字段');
  }

  const pixels = d.pixels as Record<string, unknown>;
  if (pixels.encoding !== 'dense' && pixels.encoding !== 'sparse') {
    throw new Error('无效的项目文件：不支持的像素编码格式');
  }

  if (!Array.isArray(pixels.data)) {
    throw new Error('无效的项目文件：像素数据不是数组');
  }
}

/**
 * Migrate older format versions to current.
 * For now (v1.0.0), this is a pass-through.
 */
function migrateFormat(data: ProjectFileData): ProjectFileData {
  // Future migration logic:
  // if (semverLt(data.formatVersion, '2.0.0')) { ... migrate ... }
  return data;
}

/**
 * Try to import a legacy JSON export (the old exportJSON format).
 * Returns null if the data doesn't match the legacy format.
 */
function tryParseLegacyJSON(data: unknown): LoadedProjectState | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;

  // Legacy format has version: "1.0", grid: { cols, rows }, pixels: [...]
  if (d.version !== '1.0') return null;
  if (!d.grid || typeof d.grid !== 'object') return null;

  const grid = d.grid as Record<string, unknown>;
  const cols = grid.cols as number;
  const rows = grid.rows as number;
  if (typeof cols !== 'number' || typeof rows !== 'number') return null;

  const pixelsRaw = d.pixels;
  if (!Array.isArray(pixelsRaw)) return null;

  const defaultSystem: ColorSystem = 'MARD';
  const palette = buildPalette(defaultSystem);

  // Parse legacy pixel format: { key, color, transparent }
  const pixels: MappedPixel[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: MappedPixel[] = [];
    const rawRow = pixelsRaw[r];
    if (!Array.isArray(rawRow)) {
      // Fill row with transparent
      for (let c = 0; c < cols; c++) {
        row.push({ ...transparentPixel });
      }
    } else {
      for (let c = 0; c < cols; c++) {
        const cell = rawRow[c];
        if (cell && typeof cell === 'object' && !cell.transparent) {
          row.push({
            key: cell.key ?? TRANSPARENT_KEY,
            color: cell.color ?? '#FFFFFF',
            isExternal: false,
          });
        } else {
          row.push({ ...transparentPixel });
        }
      }
    }
    pixels.push(row);
  }

  return {
    projectName: '导入的项目',
    gridDimensions: { N: cols, M: rows },
    gridType: 'square',
    canvasMode: 'fixed',
    colorSystem: defaultSystem,
    palette,
    selectedColor: palette[0] ?? null,
    lockedColors: new Set(),
    maxColors: 0,
    pixels,
  };
}

/**
 * Deserialize a JSON string or pre-parsed object into loadable project state.
 * Supports both the new .pds format and the legacy export format.
 */
export function deserializeProject(input: string | unknown): LoadedProjectState {
  let data: unknown;
  if (typeof input === 'string') {
    try {
      data = JSON.parse(input);
    } catch {
      throw new Error('无法解析项目文件：JSON 格式错误');
    }
  } else {
    data = input;
  }

  // Try legacy format first
  const legacy = tryParseLegacyJSON(data);
  if (legacy) return legacy;

  // Validate new format
  validateProjectFile(data);

  // Migrate if needed
  const migrated = migrateFormat(data);

  const { meta, grid, palette: paletteMeta, pixels: pixelsData } = migrated;

  // Rebuild palette from color system
  const palette = buildPalette(paletteMeta.colorSystem);

  // Decode pixels
  const decodedPixels =
    pixelsData.encoding === 'sparse'
      ? decodeSparse(pixelsData.data as SparsePixelEntry[], grid.rows, grid.cols)
      : decodeDense(pixelsData.data as DensePixel[][], grid.rows, grid.cols);

  // Resolve selected color
  let selectedColor: PaletteColor | null = null;
  if (paletteMeta.selectedColorHex) {
    selectedColor = palette.find((c) => c.hex === paletteMeta.selectedColorHex) ?? palette[0] ?? null;
  } else {
    selectedColor = palette[0] ?? null;
  }

  // Resolve locked colors (only keep those that exist in the palette)
  const paletteHexSet = new Set(palette.map((c) => c.hex));
  const lockedColors = new Set(
    paletteMeta.lockedColors.filter((hex) => paletteHexSet.has(hex))
  );

  return {
    projectName: meta.name || '未命名项目',
    gridDimensions: { N: grid.cols, M: grid.rows },
    gridType: grid.type || 'square',
    canvasMode: grid.canvasMode || 'fixed',
    colorSystem: paletteMeta.colorSystem || 'MARD',
    palette,
    selectedColor,
    lockedColors,
    maxColors: paletteMeta.maxColors ?? 0,
    pixels: decodedPixels,
  };
}

/**
 * Convert project file data to a formatted JSON string for saving.
 */
export function stringifyProject(data: ProjectFileData): string {
  return JSON.stringify(data, null, 2);
}
