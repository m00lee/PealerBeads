// ============================================================
// PealerBeads – File Operations (Tauri native file dialogs & FS)
// ============================================================
//
// Wraps Tauri dialog + fs plugins for save/open/recent-files.
// Falls back gracefully when not running inside Tauri (browser mode).
// Uses dynamic imports so that Tauri modules are only loaded at call-time,
// avoiding top-level initialization errors in browser environments.
// ============================================================

import {
  type ProjectFileData,
  serializeProject,
  deserializeProject,
  stringifyProject,
  FILE_EXTENSION,
  FILE_FILTER_NAME,
  type LoadedProjectState,
} from '@/lib/projectFile';
import type {
  MappedPixel,
  GridDimensions,
  GridType,
  ColorSystem,
  PaletteColor,
  CanvasMode,
} from '@/types';

// ---- Recent Files ----

export interface RecentFile {
  path: string;
  name: string;
  thumbnail?: string;
  updatedAt: string;
}

const RECENT_FILES_KEY = 'pealerbeads_recent_files';
const MAX_RECENT_FILES = 10;

/**
 * Retrieve the recent files list from localStorage.
 */
export function getRecentFiles(): RecentFile[] {
  try {
    const raw = localStorage.getItem(RECENT_FILES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, MAX_RECENT_FILES);
  } catch {
    return [];
  }
}

/**
 * Add or update a file entry in the recent files list.
 */
export function addRecentFile(file: RecentFile): void {
  const list = getRecentFiles().filter((f) => f.path !== file.path);
  list.unshift(file);
  if (list.length > MAX_RECENT_FILES) list.length = MAX_RECENT_FILES;
  try {
    localStorage.setItem(RECENT_FILES_KEY, JSON.stringify(list));
  } catch {
    // localStorage might be full — silently ignore
  }
}

/**
 * Remove a file from the recent files list.
 */
export function removeRecentFile(path: string): void {
  const list = getRecentFiles().filter((f) => f.path !== path);
  localStorage.setItem(RECENT_FILES_KEY, JSON.stringify(list));
}

/**
 * Clear all recent files.
 */
export function clearRecentFiles(): void {
  localStorage.removeItem(RECENT_FILES_KEY);
}

// ---- Tauri Environment Detection ----

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

// ---- File Dialog Wrappers ----

/**
 * Show a "Save As" dialog. Returns the chosen file path, or null if cancelled.
 */
export async function showSaveDialog(defaultName: string): Promise<string | null> {
  if (!isTauri()) {
    return null;
  }

  const { save } = await import('@tauri-apps/plugin-dialog');
  const result = await save({
    title: '保存设计文件',
    defaultPath: defaultName.endsWith(FILE_EXTENSION)
      ? defaultName
      : defaultName + FILE_EXTENSION,
    filters: [
      {
        name: FILE_FILTER_NAME,
        extensions: ['pds'],
      },
    ],
  });

  return result ?? null;
}

/**
 * Show an "Open" dialog. Returns the chosen file path, or null if cancelled.
 */
export async function showOpenDialog(): Promise<string | null> {
  if (!isTauri()) {
    return null;
  }

  const { open } = await import('@tauri-apps/plugin-dialog');
  const result = await open({
    title: '打开设计文件',
    multiple: false,
    directory: false,
    filters: [
      {
        name: FILE_FILTER_NAME,
        extensions: ['pds', 'json'],
      },
    ],
  });

  // open() returns string | string[] | null
  if (Array.isArray(result)) return result[0] ?? null;
  return result ?? null;
}

// ---- File Read / Write ----

/**
 * Write a project to a file path using Tauri FS.
 */
export async function writeProjectFile(
  filePath: string,
  data: ProjectFileData
): Promise<void> {
  const { writeTextFile } = await import('@tauri-apps/plugin-fs');
  const content = stringifyProject(data);
  await writeTextFile(filePath, content);
}

/**
 * Read and parse a project file from a path using Tauri FS.
 */
export async function readProjectFile(filePath: string): Promise<LoadedProjectState> {
  const { readTextFile } = await import('@tauri-apps/plugin-fs');
  const content = await readTextFile(filePath);
  return deserializeProject(content);
}

// ---- High-Level Operations ----

/**
 * Save project to a specified path. Serializes state and writes to disk.
 * Returns the serialized data (for thumbnail extraction, etc.).
 */
export async function saveProjectToPath(
  filePath: string,
  state: {
    projectName: string;
    gridDimensions: GridDimensions;
    gridType: GridType;
    canvasMode: CanvasMode;
    colorSystem: ColorSystem;
    selectedColor: PaletteColor | null;
    lockedColors: Set<string>;
    maxColors: number;
    pixels: MappedPixel[][];
    createdAt?: string;
  }
): Promise<ProjectFileData> {
  const data = serializeProject(state);
  await writeProjectFile(filePath, data);

  // Update recent files
  addRecentFile({
    path: filePath,
    name: data.meta.name,
    thumbnail: data.meta.thumbnail,
    updatedAt: data.meta.updatedAt,
  });

  return data;
}

/**
 * Open a project from a specified path.
 * Returns the loaded state ready to apply to the store.
 */
export async function openProjectFromPath(filePath: string): Promise<{
  state: LoadedProjectState;
  filePath: string;
  createdAt: string;
}> {
  const { readTextFile } = await import('@tauri-apps/plugin-fs');
  const content = await readTextFile(filePath);
  const parsed = JSON.parse(content);
  const state = deserializeProject(parsed);

  // Extract createdAt from file if available
  const createdAt = parsed?.meta?.createdAt ?? new Date().toISOString();

  // Update recent files
  addRecentFile({
    path: filePath,
    name: state.projectName,
    thumbnail: parsed?.meta?.thumbnail,
    updatedAt: parsed?.meta?.updatedAt ?? new Date().toISOString(),
  });

  return { state, filePath, createdAt };
}

// ---- Browser Fallback (for non-Tauri environments) ----

/**
 * Download project as a file in the browser.
 */
export function downloadProjectFile(
  state: {
    projectName: string;
    gridDimensions: GridDimensions;
    gridType: GridType;
    canvasMode: CanvasMode;
    colorSystem: ColorSystem;
    selectedColor: PaletteColor | null;
    lockedColors: Set<string>;
    maxColors: number;
    pixels: MappedPixel[][];
    createdAt?: string;
  }
): ProjectFileData {
  const data = serializeProject(state);
  const content = stringifyProject(data);
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${data.meta.name}${FILE_EXTENSION}`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return data;
}

/**
 * Open project from a browser file input.
 * Returns loaded state from the selected file.
 */
export function openProjectFromFile(): Promise<LoadedProjectState> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pds,.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        reject(new Error('没有选择文件'));
        return;
      }
      try {
        const text = await file.text();
        const state = deserializeProject(text);
        resolve(state);
      } catch (err) {
        reject(err);
      }
    };
    input.click();
  });
}
