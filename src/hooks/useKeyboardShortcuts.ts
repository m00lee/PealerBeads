import { useEffect, useRef } from 'react';
import { useStore, useTemporalStore } from '@/store/useStore';
import type { ToolType } from '@/types';

/** Global keyboard shortcuts */
export function useKeyboardShortcuts() {
  const {
    setActiveTool,
    setShowImportModal,
    setShowExportPanel,
    setZoom,
    zoom,
    // Selection operations
    copySelection,
    cutSelection,
    pasteClipboard,
    deleteSelection,
    selection,
    clipboard,
    floatingSelection,
    commitFloating,
    setSelection,
    setFloatingSelection,
    // Project file operations
    saveProject,
    saveProjectAs,
    openProject,
    newProject,
  } = useStore();
  const { undo, redo } = useTemporalStore();

  // Use ref to avoid re-registering the handler when zoom changes
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  // Refs for selection state
  const selectionRef = useRef(selection);
  selectionRef.current = selection;
  const clipboardRef = useRef(clipboard);
  clipboardRef.current = clipboard;
  const floatingRef = useRef(floatingSelection);
  floatingRef.current = floatingSelection;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Skip if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      const ctrl = e.ctrlKey || e.metaKey;

      // Escape → deselect or cancel floating
      if (e.key === 'Escape') {
        if (floatingRef.current) {
          // Cancel floating without committing (discard)
          setFloatingSelection(null);
          return;
        }
        if (selectionRef.current) {
          setSelection(null);
          return;
        }
      }

      // Enter → commit floating selection
      if (e.key === 'Enter' && floatingRef.current) {
        e.preventDefault();
        commitFloating();
        return;
      }

      // Delete / Backspace → delete selection
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectionRef.current && selectionRef.current.cells.size > 0) {
        e.preventDefault();
        deleteSelection();
        return;
      }

      // Ctrl+C → Copy selection
      if (ctrl && e.key === 'c' && selectionRef.current && selectionRef.current.cells.size > 0) {
        e.preventDefault();
        copySelection();
        return;
      }

      // Ctrl+X → Cut selection
      if (ctrl && e.key === 'x' && selectionRef.current && selectionRef.current.cells.size > 0) {
        e.preventDefault();
        cutSelection();
        return;
      }

      // Ctrl+V → Paste
      if (ctrl && e.key === 'v' && clipboardRef.current) {
        e.preventDefault();
        pasteClipboard(0, 0);
        return;
      }

      // Ctrl+A → Select all
      if (ctrl && e.key === 'a') {
        e.preventDefault();
        const { gridDimensions: dims } = useStore.getState();
        const cells = new Set<string>();
        for (let r = 0; r < dims.M; r++) {
          for (let c = 0; c < dims.N; c++) {
            cells.add(`${r},${c}`);
          }
        }
        setSelection({
          cells,
          bounds: { minRow: 0, maxRow: dims.M - 1, minCol: 0, maxCol: dims.N - 1 },
        });
        useStore.getState().setActiveTool('select');
        return;
      }

      // Ctrl+Shift+S → Save As (must check before Ctrl+S)
      if (ctrl && e.key.toLowerCase() === 's' && e.shiftKey) {
        e.preventDefault();
        saveProjectAs();
        return;
      }
      // Ctrl+S → Save
      if (ctrl && e.key === 's' && !e.shiftKey) {
        e.preventDefault();
        saveProject();
        return;
      }
      // Ctrl+O → Open
      if (ctrl && e.key === 'o') {
        e.preventDefault();
        openProject();
        return;
      }
      // Ctrl+N → New Project
      if (ctrl && e.key === 'n') {
        e.preventDefault();
        newProject();
        return;
      }
      // Ctrl+Z → Undo
      if (ctrl && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }
      // Ctrl+Shift+Z or Ctrl+Y → Redo
      if ((ctrl && e.key === 'z' && e.shiftKey) || (ctrl && e.key === 'y')) {
        e.preventDefault();
        redo();
        return;
      }
      // Ctrl+I → Import
      if (ctrl && e.key === 'i') {
        e.preventDefault();
        setShowImportModal(true);
        return;
      }
      // Ctrl+E → Export
      if (ctrl && e.key === 'e') {
        e.preventDefault();
        setShowExportPanel(true);
        return;
      }
      // Ctrl+= → Zoom in
      if (ctrl && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        setZoom(zoomRef.current * 1.2);
        return;
      }
      // Ctrl+- → Zoom out
      if (ctrl && e.key === '-') {
        e.preventDefault();
        setZoom(zoomRef.current / 1.2);
        return;
      }
      // Ctrl+0 → Reset zoom
      if (ctrl && e.key === '0') {
        e.preventDefault();
        setZoom(1);
        return;
      }

      // Tool shortcuts (no modifier)
      if (!ctrl && !e.altKey) {
        const toolMap: Record<string, ToolType> = {
          b: 'pencil',
          e: 'eraser',
          g: 'fill',
          i: 'eyedropper',
          v: 'select',
          h: 'move',
          l: 'line',
          r: 'rect',
          c: 'circle',
        };
        const tool = toolMap[e.key.toLowerCase()];
        if (tool) {
          setActiveTool(tool);
          return;
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo, setActiveTool, setShowImportModal, setShowExportPanel, setZoom,
      copySelection, cutSelection, pasteClipboard, deleteSelection, commitFloating, setSelection, setFloatingSelection,
      saveProject, saveProjectAs, openProject, newProject]);
}
