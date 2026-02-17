// ============================================================
// PealerBeads – Auto-Save Hook
// ============================================================
//
// Periodically saves the project when there are unsaved changes.
// Also handles beforeunload warning and dirty tracking via
// store subscription.
// ============================================================

import { useEffect, useRef } from 'react';
import { useStore } from '@/store/useStore';

const AUTO_SAVE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Hook: Auto-save the project at regular intervals when dirty.
 * Also warns on browser/window close if there are unsaved changes.
 */
export function useAutoSave() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Set up auto-save interval
    intervalRef.current = setInterval(() => {
      const state = useStore.getState();
      if (state.isDirty && state.currentFilePath) {
        // Only auto-save if we have a file path (don't pop up dialog)
        state.saveProject().catch((err) => {
          console.warn('自动保存失败:', err);
        });
      }
    }, AUTO_SAVE_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Warn on window close if dirty
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const state = useStore.getState();
      if (state.isDirty) {
        e.preventDefault();
        // Modern browsers ignore custom messages but still show a generic prompt
        e.returnValue = '您有未保存的更改，确定要离开吗？';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);
}

/**
 * Hook: Track changes to project-relevant state fields and mark as dirty.
 * Subscribes to the store and watches for changes in key fields.
 */
export function useDirtyTracking() {
  useEffect(() => {
    // Fields that constitute "project data" — when these change, project is dirty
    let prevPixels = useStore.getState().pixels;
    let prevDims = useStore.getState().gridDimensions;
    let prevGridType = useStore.getState().gridType;
    let prevColorSystem = useStore.getState().colorSystem;
    let prevMaxColors = useStore.getState().maxColors;
    let prevProjectName = useStore.getState().projectName;
    let prevCanvasMode = useStore.getState().canvasMode;
    let prevLockedColors = useStore.getState().lockedColors;

    const unsub = useStore.subscribe((state) => {
      // When isDirty is explicitly set to false (e.g. after save/load),
      // sync all refs to current values without triggering markDirty.
      if (!state.isDirty) {
        prevPixels = state.pixels;
        prevDims = state.gridDimensions;
        prevGridType = state.gridType;
        prevColorSystem = state.colorSystem;
        prevMaxColors = state.maxColors;
        prevProjectName = state.projectName;
        prevCanvasMode = state.canvasMode;
        prevLockedColors = state.lockedColors;
        return;
      }

      const changed =
        state.pixels !== prevPixels ||
        state.gridDimensions !== prevDims ||
        state.gridType !== prevGridType ||
        state.colorSystem !== prevColorSystem ||
        state.maxColors !== prevMaxColors ||
        state.projectName !== prevProjectName ||
        state.canvasMode !== prevCanvasMode ||
        state.lockedColors !== prevLockedColors;

      if (changed) {
        state.markDirty();
      }

      // Update refs
      prevPixels = state.pixels;
      prevDims = state.gridDimensions;
      prevGridType = state.gridType;
      prevColorSystem = state.colorSystem;
      prevMaxColors = state.maxColors;
      prevProjectName = state.projectName;
      prevCanvasMode = state.canvasMode;
      prevLockedColors = state.lockedColors;
    });

    return unsub;
  }, []);
}
