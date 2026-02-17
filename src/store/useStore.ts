import { create } from 'zustand';
import { temporal } from 'zundo';
import {
  type MappedPixel,
  type PaletteColor,
  type GridDimensions,
  type GridType,
  type ColorSystem,
  type ToolType,
  type CanvasMode,
  type SelectionMode,
  type Selection,
  type ClipboardData,
  type FloatingSelection,
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
import type { LoadedProjectState } from '@/lib/projectFile';
import {
  showSaveDialog,
  showOpenDialog,
  saveProjectToPath,
  openProjectFromPath,
  downloadProjectFile,
  openProjectFromFile,
  type RecentFile,
  getRecentFiles,
} from '@/lib/fileOperations';

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

  // -- Canvas Mode --
  canvasMode: CanvasMode;
  setCanvasMode: (m: CanvasMode) => void;
  /** Expand the grid to at least the given dimensions, preserving existing content */
  ensureGridSize: (minN: number, minM: number) => void;

  // -- Selection --
  selection: Selection | null;
  selectionMode: SelectionMode;
  clipboard: ClipboardData | null;
  floatingSelection: FloatingSelection | null;
  setSelection: (s: Selection | null) => void;
  setSelectionMode: (m: SelectionMode) => void;
  setFloatingSelection: (f: FloatingSelection | null) => void;
  copySelection: () => void;
  cutSelection: () => void;
  pasteClipboard: (atRow?: number, atCol?: number) => void;
  deleteSelection: () => void;
  mirrorSelectionH: () => void;
  mirrorSelectionV: () => void;
  /** Move selected pixels by delta; returns new pixels */
  moveSelectionBy: (dRow: number, dCol: number) => void;
  /** Commit floating selection onto the grid */
  commitFloating: () => void;
  /** Lift selection into floating */
  liftSelection: () => void;

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

  // -- Project File Management --
  currentFilePath: string | null;
  isDirty: boolean;
  createdAt: string | null;
  recentFiles: RecentFile[];
  showUnsavedDialog: boolean;
  pendingAction: (() => void) | null;
  setCurrentFilePath: (p: string | null) => void;
  markDirty: () => void;
  markClean: () => void;
  setShowUnsavedDialog: (v: boolean) => void;
  setPendingAction: (a: (() => void) | null) => void;
  refreshRecentFiles: () => void;
  /** Load deserialized project data into the store */
  loadProjectData: (data: LoadedProjectState, filePath?: string | null, createdAt?: string | null) => void;
  /** Save project: if path known, overwrite; otherwise prompt Save As */
  saveProject: () => Promise<boolean>;
  /** Always prompt Save As dialog */
  saveProjectAs: () => Promise<boolean>;
  /** Open project from file dialog */
  openProject: () => Promise<boolean>;
  /** New project (checks unsaved changes) */
  newProject: () => void;
  /** Open a specific recent file */
  openRecentFile: (path: string) => Promise<boolean>;

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

/** Extract project-relevant state fields for serialization */
function _getProjectSnapshot(state: AppState) {
  return {
    projectName: state.projectName,
    gridDimensions: state.gridDimensions,
    gridType: state.gridType,
    canvasMode: state.canvasMode,
    colorSystem: state.colorSystem,
    selectedColor: state.selectedColor,
    lockedColors: state.lockedColors,
    maxColors: state.maxColors,
    pixels: state.pixels,
    createdAt: state.createdAt ?? undefined,
  };
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

      // -- Canvas Mode --
      canvasMode: 'fixed' as CanvasMode,
      setCanvasMode: (m) => set({ canvasMode: m }),
      ensureGridSize: (minN, minM) => {
        const { gridDimensions: dims, pixels } = get();
        const newN = Math.max(dims.N, minN);
        const newM = Math.max(dims.M, minM);
        if (newN === dims.N && newM === dims.M) return;
        const next: MappedPixel[][] = [];
        for (let r = 0; r < newM; r++) {
          const row: MappedPixel[] = [];
          for (let c = 0; c < newN; c++) {
            row.push(pixels[r]?.[c] ?? { ...transparentPixel });
          }
          next.push(row);
        }
        set({ pixels: next, gridDimensions: { N: newN, M: newM } });
      },

      // -- Selection --
      selection: null as Selection | null,
      selectionMode: 'rect' as SelectionMode,
      clipboard: null as ClipboardData | null,
      floatingSelection: null as FloatingSelection | null,
      setSelection: (s) => set({ selection: s }),
      setSelectionMode: (m) => set({ selectionMode: m }),
      setFloatingSelection: (f) => set({ floatingSelection: f }),

      copySelection: () => {
        const { selection, pixels } = get();
        if (!selection || selection.cells.size === 0) return;
        const { minRow, maxRow, minCol, maxCol } = selection.bounds;
        const h = maxRow - minRow + 1;
        const w = maxCol - minCol + 1;
        const clip: (MappedPixel | null)[][] = [];
        for (let r = 0; r < h; r++) {
          const row: (MappedPixel | null)[] = [];
          for (let c = 0; c < w; c++) {
            const key = `${minRow + r},${minCol + c}`;
            if (selection.cells.has(key)) {
              const px = pixels[minRow + r]?.[minCol + c];
              row.push(px ? { ...px } : null);
            } else {
              row.push(null);
            }
          }
          clip.push(row);
        }
        set({ clipboard: { pixels: clip, width: w, height: h } });
      },

      cutSelection: () => {
        const { selection, pixels } = get();
        if (!selection || selection.cells.size === 0) return;
        // Copy first
        get().copySelection();
        // Then clear
        const next = pixels.map((r) => [...r]);
        for (const cellKey of selection.cells) {
          const [rs, cs] = cellKey.split(',');
          const r = parseInt(rs), c = parseInt(cs);
          if (next[r]?.[c]) next[r][c] = { ...transparentPixel };
        }
        set({ pixels: next, selection: null });
      },

      pasteClipboard: (atRow = 0, atCol = 0) => {
        const { clipboard, canvasMode } = get();
        if (!clipboard) return;
        // Create a floating selection for paste
        set({
          floatingSelection: {
            pixels: clipboard.pixels.map((r) => r.map((c) => c ? { ...c } : null)),
            width: clipboard.width,
            height: clipboard.height,
            offsetRow: atRow,
            offsetCol: atCol,
          },
        });
        // If infinite mode, ensure grid is large enough
        if (canvasMode === 'infinite') {
          get().ensureGridSize(atCol + clipboard.width, atRow + clipboard.height);
        }
      },

      deleteSelection: () => {
        const { selection, pixels } = get();
        if (!selection || selection.cells.size === 0) return;
        const next = pixels.map((r) => [...r]);
        for (const cellKey of selection.cells) {
          const [rs, cs] = cellKey.split(',');
          const r = parseInt(rs), c = parseInt(cs);
          if (next[r]?.[c]) next[r][c] = { ...transparentPixel };
        }
        set({ pixels: next, selection: null });
      },

      mirrorSelectionH: () => {
        const { selection, pixels } = get();
        if (!selection || selection.cells.size === 0) return;
        const { minRow, maxRow, minCol, maxCol } = selection.bounds;
        const next = pixels.map((r) => [...r]);
        // Collect selected pixels
        const w = maxCol - minCol + 1;
        for (let r = minRow; r <= maxRow; r++) {
          const rowPixels: (MappedPixel | null)[] = [];
          for (let c = minCol; c <= maxCol; c++) {
            const key = `${r},${c}`;
            if (selection.cells.has(key) && next[r]?.[c]) {
              rowPixels.push({ ...next[r][c] });
            } else {
              rowPixels.push(null);
            }
          }
          // Write mirrored
          for (let c = 0; c < w; c++) {
            const src = rowPixels[w - 1 - c];
            const key = `${r},${minCol + c}`;
            if (selection.cells.has(key) && src && next[r]?.[minCol + c]) {
              next[r][minCol + c] = src;
            }
          }
        }
        set({ pixels: next });
      },

      mirrorSelectionV: () => {
        const { selection, pixels } = get();
        if (!selection || selection.cells.size === 0) return;
        const { minRow, maxRow, minCol, maxCol } = selection.bounds;
        const next = pixels.map((r) => [...r]);
        const h = maxRow - minRow + 1;
        for (let c = minCol; c <= maxCol; c++) {
          const colPixels: (MappedPixel | null)[] = [];
          for (let r = minRow; r <= maxRow; r++) {
            const key = `${r},${c}`;
            if (selection.cells.has(key) && next[r]?.[c]) {
              colPixels.push({ ...next[r][c] });
            } else {
              colPixels.push(null);
            }
          }
          for (let r = 0; r < h; r++) {
            const src = colPixels[h - 1 - r];
            const key = `${minRow + r},${c}`;
            if (selection.cells.has(key) && src && next[minRow + r]?.[c]) {
              next[minRow + r][c] = src;
            }
          }
        }
        set({ pixels: next });
      },

      moveSelectionBy: (dRow, dCol) => {
        const { selection, pixels, gridDimensions: dims, canvasMode } = get();
        if (!selection || selection.cells.size === 0) return;
        const { minRow, maxRow, minCol, maxCol } = selection.bounds;
        // Collect selected pixels
        const collected: { r: number; c: number; px: MappedPixel }[] = [];
        for (const cellKey of selection.cells) {
          const [rs, cs] = cellKey.split(',');
          const r = parseInt(rs), c = parseInt(cs);
          if (pixels[r]?.[c]) {
            collected.push({ r, c, px: { ...pixels[r][c] } });
          }
        }
        // Auto-expand in infinite mode
        if (canvasMode === 'infinite') {
          get().ensureGridSize(
            Math.max(dims.N, maxCol + dCol + 1),
            Math.max(dims.M, maxRow + dRow + 1),
          );
        }
        const currentPixels = get().pixels;
        const currentDims = get().gridDimensions;
        const next = currentPixels.map((r) => [...r]);
        // Clear old positions
        for (const { r, c } of collected) {
          if (next[r]?.[c]) next[r][c] = { ...transparentPixel };
        }
        // Place at new positions
        for (const { r, c, px } of collected) {
          const nr = r + dRow, nc = c + dCol;
          if (nr >= 0 && nr < currentDims.M && nc >= 0 && nc < currentDims.N) {
            next[nr][nc] = px;
          }
        }
        // Update selection bounds
        const newCells = new Set<string>();
        for (const { r, c } of collected) {
          const nr = r + dRow, nc = c + dCol;
          if (nr >= 0 && nr < currentDims.M && nc >= 0 && nc < currentDims.N) {
            newCells.add(`${nr},${nc}`);
          }
        }
        set({
          pixels: next,
          selection: {
            cells: newCells,
            bounds: {
              minRow: minRow + dRow,
              maxRow: maxRow + dRow,
              minCol: minCol + dCol,
              maxCol: maxCol + dCol,
            },
          },
        });
      },

      commitFloating: () => {
        const { floatingSelection, pixels, gridDimensions: dims, canvasMode } = get();
        if (!floatingSelection) return;
        const { pixels: fPixels, offsetRow, offsetCol, width, height } = floatingSelection;
        // Auto-expand in infinite mode
        if (canvasMode === 'infinite') {
          get().ensureGridSize(offsetCol + width, offsetRow + height);
        }
        const currentPixels = get().pixels;
        const currentDims = get().gridDimensions;
        const next = currentPixels.map((r) => [...r]);
        for (let r = 0; r < height; r++) {
          for (let c = 0; c < width; c++) {
            const px = fPixels[r]?.[c];
            if (px && !px.isExternal) {
              const gr = offsetRow + r;
              const gc = offsetCol + c;
              if (gr >= 0 && gr < currentDims.M && gc >= 0 && gc < currentDims.N) {
                next[gr][gc] = { ...px };
              }
            }
          }
        }
        set({ pixels: next, floatingSelection: null });
      },

      liftSelection: () => {
        const { selection, pixels } = get();
        if (!selection || selection.cells.size === 0) return;
        const { minRow, maxRow, minCol, maxCol } = selection.bounds;
        const h = maxRow - minRow + 1;
        const w = maxCol - minCol + 1;
        const fPixels: (MappedPixel | null)[][] = [];
        const next = pixels.map((r) => [...r]);
        for (let r = 0; r < h; r++) {
          const row: (MappedPixel | null)[] = [];
          for (let c = 0; c < w; c++) {
            const key = `${minRow + r},${minCol + c}`;
            if (selection.cells.has(key) && pixels[minRow + r]?.[minCol + c]) {
              const px = pixels[minRow + r][minCol + c];
              row.push({ ...px });
              next[minRow + r][minCol + c] = { ...transparentPixel };
            } else {
              row.push(null);
            }
          }
          fPixels.push(row);
        }
        set({
          pixels: next,
          floatingSelection: {
            pixels: fPixels,
            width: w,
            height: h,
            offsetRow: minRow,
            offsetCol: minCol,
          },
          selection: null,
        });
      },

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

      // -- Project File Management --
      currentFilePath: null,
      isDirty: false,
      createdAt: null,
      recentFiles: getRecentFiles(),
      showUnsavedDialog: false,
      pendingAction: null,
      setCurrentFilePath: (p) => set({ currentFilePath: p }),
      markDirty: () => set({ isDirty: true }),
      markClean: () => set({ isDirty: false }),
      setShowUnsavedDialog: (v) => set({ showUnsavedDialog: v }),
      setPendingAction: (a) => set({ pendingAction: a }),
      refreshRecentFiles: () => set({ recentFiles: getRecentFiles() }),

      loadProjectData: (data, filePath = null, createdAt = null) => {
        set({
          projectName: data.projectName,
          gridDimensions: data.gridDimensions,
          gridType: data.gridType,
          canvasMode: data.canvasMode,
          colorSystem: data.colorSystem,
          palette: data.palette,
          selectedColor: data.selectedColor,
          lockedColors: data.lockedColors,
          maxColors: data.maxColors,
          pixels: data.pixels,
          currentFilePath: filePath,
          createdAt,
          isDirty: false,
          // Reset runtime state
          selection: null,
          floatingSelection: null,
          clipboard: null,
          sourceImage: null,
          sourceImageData: null,
          // Reset viewport
          zoom: 1,
          panOffset: { x: 0, y: 0 },
          previewMode: 'pixelated' as PreviewMode,
          // Clear stats cache
          _cachedColorStats: null,
          _cachedStatsPixelsRef: null,
        });
        // Clear undo history for new project
        useStore.temporal.getState().clear();
      },

      saveProject: async () => {
        const state = get();
        const isTauriEnv = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
        const snapshot = _getProjectSnapshot(state);

        if (isTauriEnv) {
          let filePath = state.currentFilePath;
          if (!filePath) {
            filePath = await showSaveDialog(state.projectName);
            if (!filePath) return false; // cancelled
          }
          try {
            const data = await saveProjectToPath(filePath, snapshot);
            set({
              currentFilePath: filePath,
              isDirty: false,
              createdAt: data.meta.createdAt,
              recentFiles: getRecentFiles(),
            });
            return true;
          } catch (err) {
            console.error('保存失败:', err);
            return false;
          }
        } else {
          // Browser fallback
          try {
            const data = downloadProjectFile(snapshot);
            set({ isDirty: false, createdAt: data.meta.createdAt });
            return true;
          } catch (err) {
            console.error('保存失败:', err);
            return false;
          }
        }
      },

      saveProjectAs: async () => {
        const state = get();
        const isTauriEnv = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
        const snapshot = _getProjectSnapshot(state);

        if (isTauriEnv) {
          const filePath = await showSaveDialog(state.projectName);
          if (!filePath) return false;
          try {
            const data = await saveProjectToPath(filePath, snapshot);
            set({
              currentFilePath: filePath,
              isDirty: false,
              createdAt: data.meta.createdAt,
              recentFiles: getRecentFiles(),
            });
            return true;
          } catch (err) {
            console.error('另存为失败:', err);
            return false;
          }
        } else {
          return get().saveProject();
        }
      },

      openProject: async () => {
        const state = get();
        // Check for unsaved changes
        if (state.isDirty) {
          set({
            pendingAction: () => { get().openProject(); },
            showUnsavedDialog: true,
          });
          return false;
        }

        const isTauriEnv = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

        try {
          if (isTauriEnv) {
            const filePath = await showOpenDialog();
            if (!filePath) return false;
            const result = await openProjectFromPath(filePath);
            get().loadProjectData(result.state, result.filePath, result.createdAt);
            set({ recentFiles: getRecentFiles() });
          } else {
            const loaded = await openProjectFromFile();
            get().loadProjectData(loaded);
          }
          return true;
        } catch (err) {
          console.error('打开文件失败:', err);
          alert(`打开文件失败: ${err instanceof Error ? err.message : '未知错误'}`);
          return false;
        }
      },

      openRecentFile: async (path) => {
        const state = get();
        if (state.isDirty) {
          set({
            pendingAction: () => { get().openRecentFile(path); },
            showUnsavedDialog: true,
          });
          return false;
        }

        try {
          const result = await openProjectFromPath(path);
          get().loadProjectData(result.state, result.filePath, result.createdAt);
          set({ recentFiles: getRecentFiles() });
          return true;
        } catch (err) {
          console.error('打开最近文件失败:', err);
          alert(`打开失败: ${err instanceof Error ? err.message : '文件可能已被移动或删除'}`);
          return false;
        }
      },

      newProject: () => {
        const state = get();
        if (state.isDirty) {
          set({
            pendingAction: () => { get().newProject(); },
            showUnsavedDialog: true,
          });
          return;
        }

        const freshPalette = buildPalette(defaultSystem);
        set({
          projectName: '未命名项目',
          gridDimensions: defaultDims,
          gridType: 'square' as GridType,
          canvasMode: 'fixed' as CanvasMode,
          colorSystem: defaultSystem,
          palette: freshPalette,
          selectedColor: freshPalette[0] ?? null,
          lockedColors: new Set<string>(),
          maxColors: 0,
          pixels: createEmptyGrid(defaultDims),
          currentFilePath: null,
          isDirty: false,
          createdAt: null,
          selection: null,
          floatingSelection: null,
          clipboard: null,
          sourceImage: null,
          sourceImageData: null,
          zoom: 1,
          panOffset: { x: 0, y: 0 },
          previewMode: 'pixelated' as PreviewMode,
          _cachedColorStats: null,
          _cachedStatsPixelsRef: null,
        });
        useStore.temporal.getState().clear();
      },

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
