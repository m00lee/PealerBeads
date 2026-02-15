import { create } from 'zustand';
import { temporal } from 'zundo';
import {
  type MappedPixel,
  type PaletteColor,
  type GridDimensions,
  type GridType,
  type ColorSystem,
  type ToolType,
  PixelationMode,
  DitherAlgorithm,
  type SymmetryMode,
  type PreviewMode,
  type ColorStat,
} from '@/types';
import { buildPalette } from '@/lib/colorSystem';
import { TRANSPARENT_KEY, transparentPixel } from '@/lib/pixelEditing';
import { calculatePixelGrid } from '@/lib/pixelation';
import { floydSteinbergDither, bayerDither } from '@/lib/dithering';

// ----- Tracked State (undo-able) -----
export interface TrackedState {
  pixels: MappedPixel[][];
}

// ----- Full Store State -----
export interface AppState extends TrackedState {
  // -- Project --
  projectName: string;
  setProjectName: (n: string) => void;

  // -- Grid --
  gridDimensions: GridDimensions;
  gridType: GridType;
  setGridDimensions: (d: GridDimensions) => void;
  setGridType: (t: GridType) => void;
  initGrid: (dims: GridDimensions) => void;

  // -- Pixels --
  setPixels: (p: MappedPixel[][]) => void;
  setPixel: (row: number, col: number, value: MappedPixel) => void;
  fillRegion: (cells: { row: number; col: number }[], value: MappedPixel) => void;

  // -- Palette --
  colorSystem: ColorSystem;
  palette: PaletteColor[];
  selectedColor: PaletteColor | null;
  lockedColors: Set<string>;
  maxColors: number;
  setColorSystem: (s: ColorSystem) => void;
  setSelectedColor: (c: PaletteColor | null) => void;
  toggleColorLock: (hex: string) => void;
  setMaxColors: (n: number) => void;

  // -- Tool --
  activeTool: ToolType;
  brushSize: number;
  symmetry: SymmetryMode;
  setActiveTool: (t: ToolType) => void;
  setBrushSize: (s: number) => void;
  setSymmetry: (s: SymmetryMode) => void;

  // -- Image Processing --
  pixelationMode: PixelationMode;
  ditherAlgorithm: DitherAlgorithm;
  ditherStrength: number;
  setPixelationMode: (m: PixelationMode) => void;
  setDitherAlgorithm: (a: DitherAlgorithm) => void;
  setDitherStrength: (s: number) => void;

  // -- Viewport --
  zoom: number;
  panOffset: { x: number; y: number };
  previewMode: PreviewMode;
  showGridLines: boolean;
  gridBoldEvery: number;
  setZoom: (z: number) => void;
  setPanOffset: (o: { x: number; y: number }) => void;
  setPreviewMode: (m: PreviewMode) => void;
  toggleGridLines: () => void;
  setGridBoldEvery: (n: number) => void;

  // -- Source Image --
  sourceImage: HTMLImageElement | null;
  sourceImageData: ImageData | null;
  setSourceImage: (img: HTMLImageElement | null) => void;
  setSourceImageData: (d: ImageData | null) => void;
  rePixelate: (dims: GridDimensions) => void;

  // -- UI --
  showImportModal: boolean;
  showExportPanel: boolean;
  setShowImportModal: (v: boolean) => void;
  setShowExportPanel: (v: boolean) => void;

  // -- Computed helpers (internal cache) --
  _cachedColorStats: ColorStat[] | null;
  _cachedStatsPixelsRef: MappedPixel[][] | null;
  getColorStats: () => ColorStat[];
}

// ----- Default palette -----
const defaultSystem: ColorSystem = 'MARD';
const defaultPalette = buildPalette(defaultSystem);
const defaultDims: GridDimensions = { N: 29, M: 29 };

function createEmptyGrid(dims: GridDimensions): MappedPixel[][] {
  return Array.from({ length: dims.M }, () =>
    Array.from({ length: dims.N }, () => ({ ...transparentPixel }))
  );
}

// ----- Store -----
export const useStore = create<AppState>()(
  temporal(
    (set, get) => ({
      // -- Project --
      projectName: '未命名项目',
      setProjectName: (n) => set({ projectName: n }),

      // -- Grid --
      gridDimensions: defaultDims,
      gridType: 'square' as GridType,
      setGridDimensions: (d) => set({ gridDimensions: d }),
      setGridType: (t) => set({ gridType: t }),
      initGrid: (dims) =>
        set({
          gridDimensions: dims,
          pixels: createEmptyGrid(dims),
        }),

      // -- Pixels --
      pixels: createEmptyGrid(defaultDims),
      setPixels: (p) => set({ pixels: p }),
      setPixel: (row, col, value) => {
        const pixels = get().pixels;
        if (!pixels[row]?.[col]) return;
        const next = pixels.map((r) => [...r]);
        next[row][col] = value;
        set({ pixels: next });
      },
      fillRegion: (cells, value) => {
        const pixels = get().pixels;
        const next = pixels.map((r) => [...r]);
        for (const { row, col } of cells) {
          if (next[row]?.[col]) next[row][col] = value;
        }
        set({ pixels: next });
      },

      // -- Palette --
      colorSystem: defaultSystem,
      palette: defaultPalette,
      selectedColor: defaultPalette[0] ?? null,
      lockedColors: new Set<string>(),
      maxColors: 0, // 0 = unlimited
      setColorSystem: (s) => {
        const palette = buildPalette(s);
        set({ colorSystem: s, palette, selectedColor: palette[0] ?? null });
      },
      setSelectedColor: (c) => set({ selectedColor: c }),
      toggleColorLock: (hex) => {
        const locked = new Set(get().lockedColors);
        if (locked.has(hex)) locked.delete(hex);
        else locked.add(hex);
        set({ lockedColors: locked });
      },
      setMaxColors: (n) => set({ maxColors: n }),

      // -- Tool --
      activeTool: 'pencil' as ToolType,
      brushSize: 1,
      symmetry: 'none' as SymmetryMode,
      setActiveTool: (t) => set({ activeTool: t }),
      setBrushSize: (s) => set({ brushSize: s }),
      setSymmetry: (s) => set({ symmetry: s }),

      // -- Image Processing --
      pixelationMode: PixelationMode.Dominant,
      ditherAlgorithm: DitherAlgorithm.None,
      ditherStrength: 0.5,
      setPixelationMode: (m) => set({ pixelationMode: m }),
      setDitherAlgorithm: (a) => set({ ditherAlgorithm: a }),
      setDitherStrength: (s) => set({ ditherStrength: s }),

      // -- Viewport --
      zoom: 1,
      panOffset: { x: 0, y: 0 },
      previewMode: 'pixelated' as PreviewMode,
      showGridLines: true,
      gridBoldEvery: 5,
      setZoom: (z) => set({ zoom: Math.max(0.1, Math.min(20, z)) }),
      setPanOffset: (o) => set({ panOffset: o }),
      setPreviewMode: (m) => set({ previewMode: m }),
      toggleGridLines: () => set((s) => ({ showGridLines: !s.showGridLines })),
      setGridBoldEvery: (n) => set({ gridBoldEvery: n }),

      // -- Source Image --
      sourceImage: null,
      sourceImageData: null,
      setSourceImage: (img) => set({ sourceImage: img }),
      setSourceImageData: (d) => set({ sourceImageData: d }),
      rePixelate: (dims) => {
        const { sourceImageData, palette, pixelationMode, ditherAlgorithm, ditherStrength } = get();
        if (!sourceImageData) {
          // No source image — just create empty grid
          set({ gridDimensions: dims, pixels: createEmptyGrid(dims) });
          return;
        }
        const cw = sourceImageData.width;
        const ch = sourceImageData.height;
        let resultPixels;
        if (ditherAlgorithm !== 'none') {
          const resizeCanvas = document.createElement('canvas');
          resizeCanvas.width = dims.N;
          resizeCanvas.height = dims.M;
          const resizeCtx = resizeCanvas.getContext('2d')!;
          // Draw sourceImageData onto a temp canvas first
          const srcCanvas = document.createElement('canvas');
          srcCanvas.width = cw;
          srcCanvas.height = ch;
          srcCanvas.getContext('2d')!.putImageData(sourceImageData, 0, 0);
          resizeCtx.drawImage(srcCanvas, 0, 0, dims.N, dims.M);
          const resizedData = resizeCtx.getImageData(0, 0, dims.N, dims.M);
          const ditherFn = ditherAlgorithm === 'floyd-steinberg' ? floydSteinbergDither : bayerDither;
          const paletteResult = ditherFn(resizedData, dims.N, dims.M, palette, ditherStrength);
          resultPixels = paletteResult.map((row) =>
            row.map((pc) => ({ key: pc.key, color: pc.hex, isExternal: false }))
          );
        } else {
          const fallback = palette[0] || { key: '?', hex: '#FFFFFF', rgb: { r: 255, g: 255, b: 255 } };
          resultPixels = calculatePixelGrid(
            sourceImageData, cw, ch,
            dims.N, dims.M,
            palette, pixelationMode, fallback
          );
        }
        set({ gridDimensions: dims, pixels: resultPixels });
      },

      // -- UI --
      showImportModal: false,
      showExportPanel: false,
      setShowImportModal: (v) => set({ showImportModal: v }),
      setShowExportPanel: (v) => set({ showExportPanel: v }),

      // -- Computed (cached) --
      _cachedColorStats: null as ColorStat[] | null,
      _cachedStatsPixelsRef: null as MappedPixel[][] | null,
      getColorStats: () => {
        const { pixels, _cachedColorStats, _cachedStatsPixelsRef } = get();
        // Return cached stats if pixels haven't changed (reference equality)
        if (_cachedColorStats && _cachedStatsPixelsRef === pixels) {
          return _cachedColorStats;
        }
        const counts = new Map<string, { hex: string; key: string; count: number }>();
        let total = 0;
        for (const row of pixels) {
          for (const cell of row) {
            if (cell && !cell.isExternal && cell.key !== TRANSPARENT_KEY) {
              const hex = cell.color.toUpperCase();
              const existing = counts.get(hex);
              if (existing) {
                existing.count++;
              } else {
                counts.set(hex, { hex, key: cell.key, count: 1 });
              }
              total++;
            }
          }
        }
        const stats = Array.from(counts.values()).map((c) => ({
          ...c,
          percentage: total > 0 ? (c.count / total) * 100 : 0,
        }));
        // Cache the result
        set({ _cachedColorStats: stats, _cachedStatsPixelsRef: pixels } as Partial<AppState>);
        return stats;
      },
    }),
    {
      // zundo config — only track pixel data changes for undo/redo
      partialize: (state) => ({ pixels: state.pixels }),
      limit: 100,
    }
  )
);

// Convenience hook for temporal (undo/redo)
export const useTemporalStore = () => useStore.temporal.getState();
