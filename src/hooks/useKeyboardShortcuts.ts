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
  } = useStore();
  const { undo, redo } = useTemporalStore();

  // Use ref to avoid re-registering the handler when zoom changes
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

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
  }, [undo, redo, setActiveTool, setShowImportModal, setShowExportPanel, setZoom]);
}
