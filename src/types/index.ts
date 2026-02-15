// ============================================================
// PealerBeads – Core Type Definitions
// ============================================================

// ---- Color & Palette ----

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export interface PaletteColor {
  /** Display key/code in the current color system (e.g. "A01") */
  key: string;
  /** Hex string, always uppercase with '#' (e.g. "#FAF4C8") */
  hex: string;
  /** Pre-parsed RGB for fast distance computation */
  rgb: RgbColor;
}

export interface MappedPixel {
  /** Color key in current system */
  key: string;
  /** Hex color string */
  color: string;
  /** True for transparent / erased cells */
  isExternal?: boolean;
}

// ---- Color System ----

export type ColorSystem = 'MARD' | 'COCO' | '漫漫' | '盼盼' | '咪小窝';

export interface ColorSystemOption {
  key: ColorSystem;
  name: string;
}

// ---- Grid ----

export type GridType = 'square' | 'hexagonal';

export interface GridDimensions {
  /** columns */
  N: number;
  /** rows */
  M: number;
}

/** How users specify target size */
export type SizeMode = 'board' | 'dimension' | 'beadCount';

export interface BoardPreset {
  name: string;
  cols: number;
  rows: number;
  gridType: GridType;
}

// ---- Pixelation ----

export enum PixelationMode {
  Dominant = 'dominant',
  Average = 'average',
}

export enum ResizeAlgorithm {
  NearestNeighbor = 'nearest',
  Bilinear = 'bilinear',
  Lanczos = 'lanczos',
}

export enum DitherAlgorithm {
  None = 'none',
  FloydSteinberg = 'floyd-steinberg',
  Bayer = 'bayer',
}

// ---- Tools ----

export type ToolType =
  | 'pencil'
  | 'eraser'
  | 'fill'
  | 'eyedropper'
  | 'select'
  | 'move'
  | 'line'
  | 'rect'
  | 'circle';

export type SymmetryMode = 'none' | 'horizontal' | 'vertical' | 'both';

// ---- Preview ----

export type PreviewMode = 'original' | 'pixelated' | 'gridOnly' | 'colorBlock' | 'beadView';

// ---- Export ----

export type ExportFormat = 'png' | 'pdf' | 'json' | 'csv';

/** 标准拼豆板尺寸预设 */
export interface BoardSizePreset {
  label: string;
  cols: number;
  rows: number;
}

/** 板型堆叠方式 */
export type BoardStacking = 'standard' | 'hexDense' | 'brick';

/** 规则化导出设置 */
export interface BoardExportSettings {
  boardSize: BoardSizePreset;
  stacking: BoardStacking;
  showBoardBorders: boolean;
  showPageNumbers: boolean;
  showLegend: boolean;
  cellSize: number;
  showSymbols: boolean;
  showGrid: boolean;
}

export interface ExportSettings {
  format: ExportFormat;
  showGrid: boolean;
  showSymbols: boolean;
  showLegend: boolean;
  paperSize: 'a4' | 'a3' | 'letter';
  gridBoldEvery: 5 | 10;
  originPosition: 'topLeft' | 'topRight';
  startIndex: 0 | 1;
}

// ---- Color Statistics ----

export interface ColorStat {
  hex: string;
  key: string;
  count: number;
  percentage: number;
}

// ---- History (for undo/redo) ----

export interface HistoryEntry {
  pixels: MappedPixel[][];
  timestamp: number;
  label: string;
}

// ---- Project ----

export interface ProjectData {
  version: string;
  name: string;
  gridDimensions: GridDimensions;
  gridType: GridType;
  colorSystem: ColorSystem;
  pixels: MappedPixel[][];
  palette: PaletteColor[];
  createdAt: string;
  updatedAt: string;
}
