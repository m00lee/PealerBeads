import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { useStore } from '@/store/useStore';
import { TRANSPARENT_KEY, floodFill, paintPixel, floodFillErase, linePixels, rectPixels, circlePixels, paintCells } from '@/lib/pixelEditing';
import { drawHexPath, hexCellCenter, drawBead } from '@/lib/canvasUtils';
import type { MappedPixel, GridDimensions, ToolType, Selection, SelectionMode, FloatingSelection } from '@/types';

/** Ray-casting point-in-polygon test */
function pointInPolygon(
  px: number,
  py: number,
  polygon: { col: number; row: number }[]
): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].col, yi = polygon[i].row;
    const xj = polygon[j].col, yj = polygon[j].row;
    const intersect =
      yi > py !== yj > py &&
      px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Multi-layer canvas editor with zoom/pan support */
export function EditorCanvas() {
  const gridRef = useRef<HTMLCanvasElement>(null);
  const interRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    pixels,
    gridDimensions: dims,
    gridType,
    zoom,
    panOffset,
    setZoom,
    setPanOffset,
    showGridLines,
    gridBoldEvery,
    previewMode,
    activeTool,
    selectedColor,
    brushSize,
    symmetry,
    sourceImage,
    setPixels,
    setSelectedColor,
    palette,
    // Selection
    selection,
    selectionMode,
    setSelection,
    floatingSelection,
    setFloatingSelection,
    commitFloating,
    liftSelection,
    moveSelectionBy,
    // Canvas mode
    canvasMode,
    ensureGridSize,
  } = useStore();

  const [hoverCell, setHoverCell] = useState<{ col: number; row: number } | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number } | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [shapeStart, setShapeStart] = useState<{ col: number; row: number } | null>(null);

  // Selection drag state
  const [selectStart, setSelectStart] = useState<{ col: number; row: number } | null>(null);
  const [selectEnd, setSelectEnd] = useState<{ col: number; row: number } | null>(null);
  const [lassoPoints, setLassoPoints] = useState<{ col: number; row: number }[]>([]);
  const [isSelectDragging, setIsSelectDragging] = useState(false);
  // Move-selection drag
  const [isMovingSelection, setIsMovingSelection] = useState(false);
  const [moveStart, setMoveStart] = useState<{ col: number; row: number } | null>(null);
  // Floating drag
  const [isMovingFloating, setIsMovingFloating] = useState(false);
  const [floatingDragStart, setFloatingDragStart] = useState<{ col: number; row: number } | null>(null);

  // Compute cell size from container
  const cellSize = 16; // base cell size in world units

  // ---- Refs for values that change frequently to avoid callback re-creation ----
  const pixelsRef = useRef(pixels);
  pixelsRef.current = pixels;
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const panOffsetRef = useRef(panOffset);
  panOffsetRef.current = panOffset;
  const activeToolRef = useRef(activeTool);
  activeToolRef.current = activeTool;
  const selectedColorRef = useRef(selectedColor);
  selectedColorRef.current = selectedColor;
  const brushSizeRef = useRef(brushSize);
  brushSizeRef.current = brushSize;
  const symmetryRef = useRef(symmetry);
  symmetryRef.current = symmetry;
  const shapeStartRef = useRef(shapeStart);
  shapeStartRef.current = shapeStart;
  const selectionRef = useRef(selection);
  selectionRef.current = selection;
  const selectionModeRef = useRef(selectionMode);
  selectionModeRef.current = selectionMode;
  const selectStartRef = useRef(selectStart);
  selectStartRef.current = selectStart;
  const selectEndRef = useRef(selectEnd);
  selectEndRef.current = selectEnd;
  const lassoPointsRef = useRef(lassoPoints);
  lassoPointsRef.current = lassoPoints;
  const isSelectDraggingRef = useRef(isSelectDragging);
  isSelectDraggingRef.current = isSelectDragging;
  const isMovingSelectionRef = useRef(isMovingSelection);
  isMovingSelectionRef.current = isMovingSelection;
  const moveStartRef = useRef(moveStart);
  moveStartRef.current = moveStart;
  const floatingSelectionRef = useRef(floatingSelection);
  floatingSelectionRef.current = floatingSelection;
  const isMovingFloatingRef = useRef(isMovingFloating);
  isMovingFloatingRef.current = isMovingFloating;
  const floatingDragStartRef = useRef(floatingDragStart);
  floatingDragStartRef.current = floatingDragStart;
  const canvasModeRef = useRef(canvasMode);
  canvasModeRef.current = canvasMode;

  // ---- Draw the static grid layer ----
  const drawGrid = useCallback(() => {
    const canvas = gridRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const container = containerRef.current;
    if (!container) return;

    const dpr = window.devicePixelRatio || 1;
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    canvas.width = cw * dpr;
    canvas.height = ch * dpr;
    canvas.style.width = `${cw}px`;
    canvas.style.height = `${ch}px`;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, cw, ch);
    ctx.save();
    ctx.translate(panOffset.x, panOffset.y);
    ctx.scale(zoom, zoom);

    const { N, M } = dims;

    if (gridType === 'square') {
      drawSquareGrid(ctx, pixels, dims, cellSize, showGridLines, gridBoldEvery, previewMode);
    } else {
      drawHexGrid(ctx, pixels, dims, cellSize, showGridLines, previewMode);
    }

    // Draw source image reference layer
    if (previewMode === 'original' && sourceImage) {
      ctx.globalAlpha = 0.5;
      ctx.drawImage(sourceImage, 0, 0, N * cellSize, M * cellSize);
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }, [pixels, dims, gridType, zoom, panOffset, showGridLines, gridBoldEvery, previewMode, cellSize, sourceImage]);

  // ---- Draw the interaction layer (hover, selection) ----
  const drawInteraction = useCallback(() => {
    const canvas = interRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const container = containerRef.current;
    if (!container) return;

    const dpr = window.devicePixelRatio || 1;
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    canvas.width = cw * dpr;
    canvas.height = ch * dpr;
    canvas.style.width = `${cw}px`;
    canvas.style.height = `${ch}px`;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, cw, ch);

    const currentZoom = zoomRef.current;
    const currentPanOffset = panOffsetRef.current;

    ctx.save();
    ctx.translate(currentPanOffset.x, currentPanOffset.y);
    ctx.scale(currentZoom, currentZoom);

    // ---- Draw confirmed selection overlay ----
    if (selection && selection.cells.size > 0) {
      ctx.fillStyle = 'rgba(137, 180, 250, 0.15)';
      ctx.strokeStyle = 'rgba(137, 180, 250, 0.6)';
      ctx.lineWidth = 1.5 / currentZoom;
      for (const cellKey of selection.cells) {
        const [rs, cs] = cellKey.split(',');
        const r = parseInt(rs), c = parseInt(cs);
        ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
      }
      // Draw marching-ants border around selection bounds
      const { minRow, maxRow, minCol, maxCol } = selection.bounds;
      ctx.setLineDash([4 / currentZoom, 4 / currentZoom]);
      ctx.strokeRect(
        minCol * cellSize,
        minRow * cellSize,
        (maxCol - minCol + 1) * cellSize,
        (maxRow - minRow + 1) * cellSize
      );
      ctx.setLineDash([]);
    }

    // ---- Draw selection rectangle preview during drag ----
    if (isSelectDragging && selectStart && selectEnd && selectionMode === 'rect') {
      const minC = Math.min(selectStart.col, selectEnd.col);
      const maxC = Math.max(selectStart.col, selectEnd.col);
      const minR = Math.min(selectStart.row, selectEnd.row);
      const maxR = Math.max(selectStart.row, selectEnd.row);
      ctx.fillStyle = 'rgba(137, 180, 250, 0.1)';
      ctx.fillRect(minC * cellSize, minR * cellSize, (maxC - minC + 1) * cellSize, (maxR - minR + 1) * cellSize);
      ctx.strokeStyle = 'rgba(137, 180, 250, 0.7)';
      ctx.lineWidth = 1.5 / currentZoom;
      ctx.setLineDash([4 / currentZoom, 4 / currentZoom]);
      ctx.strokeRect(minC * cellSize, minR * cellSize, (maxC - minC + 1) * cellSize, (maxR - minR + 1) * cellSize);
      ctx.setLineDash([]);
    }

    // ---- Draw lasso path during drag ----
    if (isSelectDragging && lassoPoints.length > 1 && selectionMode === 'lasso') {
      ctx.beginPath();
      ctx.moveTo(lassoPoints[0].col * cellSize + cellSize / 2, lassoPoints[0].row * cellSize + cellSize / 2);
      for (let i = 1; i < lassoPoints.length; i++) {
        ctx.lineTo(lassoPoints[i].col * cellSize + cellSize / 2, lassoPoints[i].row * cellSize + cellSize / 2);
      }
      ctx.closePath();
      ctx.fillStyle = 'rgba(137, 180, 250, 0.1)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(137, 180, 250, 0.7)';
      ctx.lineWidth = 1.5 / currentZoom;
      ctx.setLineDash([4 / currentZoom, 4 / currentZoom]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // ---- Draw floating selection ----
    if (floatingSelection) {
      const { pixels: fPx, offsetRow, offsetCol, width, height } = floatingSelection;
      // Semi-transparent background
      ctx.fillStyle = 'rgba(137, 180, 250, 0.08)';
      ctx.fillRect(offsetCol * cellSize, offsetRow * cellSize, width * cellSize, height * cellSize);
      // Draw pixels
      for (let r = 0; r < height; r++) {
        for (let c = 0; c < width; c++) {
          const px = fPx[r]?.[c];
          if (px && !px.isExternal && px.key !== TRANSPARENT_KEY) {
            ctx.fillStyle = px.color;
            const gap = cellSize * 0.06;
            const cornerR = cellSize * 0.15;
            ctx.beginPath();
            ctx.roundRect(
              (offsetCol + c) * cellSize + gap,
              (offsetRow + r) * cellSize + gap,
              cellSize - gap * 2,
              cellSize - gap * 2,
              cornerR
            );
            ctx.fill();
          }
        }
      }
      // Border
      ctx.strokeStyle = 'rgba(250, 179, 135, 0.8)';
      ctx.lineWidth = 2 / currentZoom;
      ctx.setLineDash([6 / currentZoom, 3 / currentZoom]);
      ctx.strokeRect(offsetCol * cellSize, offsetRow * cellSize, width * cellSize, height * cellSize);
      ctx.setLineDash([]);
    }

    // ---- Hover + brush/shape preview ----
    if (!hoverCell) {
      ctx.restore();
      return;
    }

    const currentTool = activeToolRef.current;
    const currentBrushSize = brushSizeRef.current;

    const { col, row } = hoverCell;

    if (gridType === 'square') {
      // Draw hover highlight
      ctx.strokeStyle = '#89b4fa';
      ctx.lineWidth = 2 / currentZoom;
      ctx.strokeRect(col * cellSize, row * cellSize, cellSize, cellSize);

      // Draw brush preview
      if (currentBrushSize > 1 && (currentTool === 'pencil' || currentTool === 'eraser')) {
        ctx.strokeStyle = 'rgba(137, 180, 250, 0.4)';
        ctx.lineWidth = 1 / currentZoom;
        const half = Math.floor(currentBrushSize / 2);
        for (let dy = -half; dy <= half; dy++) {
          for (let dx = -half; dx <= half; dx++) {
            const c = col + dx;
            const r = row + dy;
            if (c >= 0 && c < dims.N && r >= 0 && r < dims.M && !(dx === 0 && dy === 0)) {
              ctx.strokeRect(c * cellSize, r * cellSize, cellSize, cellSize);
            }
          }
        }
      }

      // Draw shape preview during drag
      const currentShapeStart = shapeStartRef.current;
      if (currentShapeStart && (currentTool === 'line' || currentTool === 'rect' || currentTool === 'circle')) {
        let shapeCells: { col: number; row: number }[] = [];
        if (currentTool === 'line') {
          shapeCells = linePixels(currentShapeStart.col, currentShapeStart.row, col, row);
        } else if (currentTool === 'rect') {
          shapeCells = rectPixels(currentShapeStart.col, currentShapeStart.row, col, row, false);
        } else if (currentTool === 'circle') {
          const dx2 = col - currentShapeStart.col;
          const dy2 = row - currentShapeStart.row;
          const radius = Math.round(Math.sqrt(dx2 * dx2 + dy2 * dy2));
          shapeCells = circlePixels(currentShapeStart.col, currentShapeStart.row, radius, false);
        }
        ctx.fillStyle = 'rgba(137, 180, 250, 0.3)';
        for (const sc of shapeCells) {
          if (sc.col >= 0 && sc.col < dims.N && sc.row >= 0 && sc.row < dims.M) {
            ctx.fillRect(sc.col * cellSize, sc.row * cellSize, cellSize, cellSize);
          }
        }
      }
    } else {
      // Hex hover
      const center = hexCellCenter(col, row, cellSize * 0.6);
      drawHexPath(ctx, center.x, center.y, cellSize * 0.6);
      ctx.strokeStyle = '#89b4fa';
      ctx.lineWidth = 2 / currentZoom;
      ctx.stroke();
    }

    ctx.restore();
  }, [hoverCell, dims, gridType, cellSize, selection, isSelectDragging, selectStart, selectEnd, selectionMode, lassoPoints, floatingSelection]);

  // ---- Effects to redraw ----
  useEffect(() => { drawGrid(); }, [drawGrid]);
  useEffect(() => { drawInteraction(); }, [drawInteraction]);

  // ---- Resize observer ----
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => {
      drawGrid();
      drawInteraction();
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [drawGrid, drawInteraction]);

  // ---- Mouse → grid coords (stable callback using refs) ----
  const getGridCell = useCallback(
    (clientX: number, clientY: number) => {
      const container = containerRef.current;
      if (!container) return null;
      const rect = container.getBoundingClientRect();
      const cx = clientX - rect.left;
      const cy = clientY - rect.top;
      const currentZoom = zoomRef.current;
      const currentPanOffset = panOffsetRef.current;
      const worldX = (cx - currentPanOffset.x) / currentZoom;
      const worldY = (cy - currentPanOffset.y) / currentZoom;

      if (gridType === 'square') {
        const col = Math.floor(worldX / cellSize);
        const row = Math.floor(worldY / cellSize);
        if (col >= 0 && col < dims.N && row >= 0 && row < dims.M) {
          return { col, row };
        }
        // In infinite mode, allow out-of-bounds positive coords
        if (canvasModeRef.current === 'infinite' && col >= 0 && row >= 0) {
          return { col, row };
        }
      } else {
        // Hex approximate hit test
        const hexR = cellSize * 0.6;
        const w = hexR * 2;
        const h = Math.sqrt(3) * hexR;
        const row = Math.floor(worldY / h);
        const isOdd = row % 2 === 1;
        const offX = isOdd ? hexR : 0;
        const col = Math.floor((worldX - offX) / w);
        if (col >= 0 && col < dims.N && row >= 0 && row < dims.M) {
          return { col, row };
        }
      }
      return null;
    },
    [dims, gridType, cellSize]
  );

  // ---- Apply tool at cell (stable callback using refs) ----
  const applyTool = useCallback(
    (col: number, row: number, tool: ToolType) => {
      const currentPixels = pixelsRef.current;
      const currentSelectedColor = selectedColorRef.current;
      const currentBrushSize = brushSizeRef.current;
      const currentSymmetry = symmetryRef.current;

      // In infinite mode, auto-expand if needed
      if (canvasModeRef.current === 'infinite') {
        const neededN = col + currentBrushSize + 1;
        const neededM = row + currentBrushSize + 1;
        if (neededN > dims.N || neededM > dims.M) {
          ensureGridSize(Math.max(dims.N, neededN), Math.max(dims.M, neededM));
        }
      }

      if (tool === 'pencil' && currentSelectedColor) {
        const value: MappedPixel = { key: currentSelectedColor.key, color: currentSelectedColor.hex, isExternal: false };
        // Apply with brush size
        const half = Math.floor(currentBrushSize / 2);
        let current = currentPixels;
        for (let dy = -half; dy <= half; dy++) {
          for (let dx = -half; dx <= half; dx++) {
            const r = row + dy;
            const c = col + dx;
            if (r >= 0 && r < dims.M && c >= 0 && c < dims.N) {
              const next = paintPixel(current, r, c, value);
              if (next) current = next;
            }
          }
        }
        // Symmetry
        if (currentSymmetry === 'horizontal' || currentSymmetry === 'both') {
          const mirrorCol = dims.N - 1 - col;
          for (let dy = -half; dy <= half; dy++) {
            for (let dx = -half; dx <= half; dx++) {
              const r = row + dy;
              const c = mirrorCol - dx;
              if (r >= 0 && r < dims.M && c >= 0 && c < dims.N) {
                const next = paintPixel(current, r, c, value);
                if (next) current = next;
              }
            }
          }
        }
        if (currentSymmetry === 'vertical' || currentSymmetry === 'both') {
          const mirrorRow = dims.M - 1 - row;
          for (let dy = -half; dy <= half; dy++) {
            for (let dx = -half; dx <= half; dx++) {
              const r = mirrorRow - dy;
              const c = col + dx;
              if (r >= 0 && r < dims.M && c >= 0 && c < dims.N) {
                const next = paintPixel(current, r, c, value);
                if (next) current = next;
              }
            }
          }
        }
        if (current !== currentPixels) setPixels(current);
      } else if (tool === 'eraser') {
        const transparent: MappedPixel = { key: TRANSPARENT_KEY, color: '#FFFFFF', isExternal: true };
        const half = Math.floor(currentBrushSize / 2);
        let current = currentPixels;
        for (let dy = -half; dy <= half; dy++) {
          for (let dx = -half; dx <= half; dx++) {
            const r = row + dy;
            const c = col + dx;
            if (r >= 0 && r < dims.M && c >= 0 && c < dims.N) {
              const next = paintPixel(current, r, c, transparent);
              if (next) current = next;
            }
          }
        }
        if (current !== currentPixels) setPixels(current);
      } else if (tool === 'fill' && currentSelectedColor) {
        const value: MappedPixel = { key: currentSelectedColor.key, color: currentSelectedColor.hex, isExternal: false };
        const next = floodFill(currentPixels, dims, row, col, value);
        setPixels(next);
      } else if (tool === 'eyedropper') {
        const cell = currentPixels[row]?.[col];
        if (cell && !cell.isExternal) {
          const match = palette.find((p) => p.hex.toUpperCase() === cell.color.toUpperCase());
          if (match) setSelectedColor(match);
        }
      }
    },
    [dims, setPixels, palette, setSelectedColor, ensureGridSize]
  );

  // ---- Mouse handlers (stable using refs) ----
  const isPanningRef = useRef(false);
  const panStartRef = useRef<{ x: number; y: number } | null>(null);
  const isDrawingRef = useRef(false);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const currentTool = activeToolRef.current;
      const currentPanOffset = panOffsetRef.current;

      if (e.button === 1 || (e.button === 0 && currentTool === 'move')) {
        // Middle-click or move tool → start panning
        isPanningRef.current = true;
        setIsPanning(true);
        panStartRef.current = { x: e.clientX - currentPanOffset.x, y: e.clientY - currentPanOffset.y };
        setPanStart(panStartRef.current);
        return;
      }

      if (e.button === 0) {
        const cell = getGridCell(e.clientX, e.clientY);

        // Handle select tool
        if (currentTool === 'select' && cell) {
          // If there's a floating selection, check if click is inside it → start moving the floating
          const currentFloating = floatingSelectionRef.current;
          if (currentFloating) {
            const { offsetRow, offsetCol, width, height } = currentFloating;
            if (
              cell.row >= offsetRow && cell.row < offsetRow + height &&
              cell.col >= offsetCol && cell.col < offsetCol + width
            ) {
              setIsMovingFloating(true);
              setFloatingDragStart(cell);
              return;
            } else {
              // Click outside → commit floating
              commitFloating();
            }
          }

          // If there's an existing selection, check if click is inside → start moving
          const currentSelection = selectionRef.current;
          if (currentSelection && currentSelection.cells.size > 0) {
            const key = `${cell.row},${cell.col}`;
            if (currentSelection.cells.has(key)) {
              // Start moving the selection
              setIsMovingSelection(true);
              setMoveStart(cell);
              liftSelection();
              return;
            }
          }

          // Otherwise, start new selection drag
          const mode = selectionModeRef.current;
          if (mode === 'rect') {
            setSelectStart(cell);
            setSelectEnd(cell);
          } else if (mode === 'lasso') {
            setLassoPoints([cell]);
          }
          setIsSelectDragging(true);
          setSelection(null);
          return;
        }

        if (cell) {
          // Shape tools: record start point, don't draw yet
          if (currentTool === 'line' || currentTool === 'rect' || currentTool === 'circle') {
            shapeStartRef.current = cell;
            setShapeStart(cell);
            isDrawingRef.current = true;
            setIsDrawing(true);
          } else {
            isDrawingRef.current = true;
            setIsDrawing(true);
            applyTool(cell.col, cell.row, currentTool);
          }
        }
      }
    },
    [getGridCell, applyTool, setSelection, commitFloating, liftSelection]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isPanningRef.current && panStartRef.current) {
        const newOffset = { x: e.clientX - panStartRef.current.x, y: e.clientY - panStartRef.current.y };
        setPanOffset(newOffset);
        return;
      }

      const cell = getGridCell(e.clientX, e.clientY);
      setHoverCell(cell);

      const currentTool = activeToolRef.current;

      // Selection drag
      if (currentTool === 'select') {
        // Moving floating
        if (isMovingFloatingRef.current && floatingDragStartRef.current && cell) {
          const currentFloating = floatingSelectionRef.current;
          if (currentFloating) {
            const dCol = cell.col - floatingDragStartRef.current.col;
            const dRow = cell.row - floatingDragStartRef.current.row;
            if (dCol !== 0 || dRow !== 0) {
              setFloatingSelection({
                ...currentFloating,
                offsetCol: currentFloating.offsetCol + dCol,
                offsetRow: currentFloating.offsetRow + dRow,
              });
              setFloatingDragStart(cell);
            }
          }
          return;
        }

        // Moving selection (now floating)
        if (isMovingSelectionRef.current && moveStartRef.current && cell) {
          const currentFloating = floatingSelectionRef.current;
          if (currentFloating) {
            const dCol = cell.col - moveStartRef.current.col;
            const dRow = cell.row - moveStartRef.current.row;
            if (dCol !== 0 || dRow !== 0) {
              setFloatingSelection({
                ...currentFloating,
                offsetCol: currentFloating.offsetCol + dCol,
                offsetRow: currentFloating.offsetRow + dRow,
              });
              setMoveStart(cell);
            }
          }
          return;
        }

        if (isSelectDraggingRef.current && cell) {
          const mode = selectionModeRef.current;
          if (mode === 'rect') {
            setSelectEnd(cell);
          } else if (mode === 'lasso') {
            setLassoPoints((prev) => {
              const last = prev[prev.length - 1];
              if (!last || last.col !== cell.col || last.row !== cell.row) {
                return [...prev, cell];
              }
              return prev;
            });
          }
        }
        return;
      }

      if (isDrawingRef.current && cell && (currentTool === 'pencil' || currentTool === 'eraser')) {
        applyTool(cell.col, cell.row, currentTool);
      }
      // For shape tools, just update hoverCell — the interaction layer will render the preview
    },
    [getGridCell, applyTool, setPanOffset, setFloatingSelection]
  );

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    const currentTool = activeToolRef.current;

    // Finalize selection
    if (currentTool === 'select') {
      // Finalize floating drag
      if (isMovingFloatingRef.current) {
        setIsMovingFloating(false);
        setFloatingDragStart(null);
        return;
      }
      // Finalize move
      if (isMovingSelectionRef.current) {
        // Commit the floating
        commitFloating();
        setIsMovingSelection(false);
        setMoveStart(null);
        return;
      }

      if (isSelectDraggingRef.current) {
        const mode = selectionModeRef.current;
        if (mode === 'rect') {
          const start = selectStartRef.current;
          const end = selectEndRef.current;
          if (start && end) {
            const minC = Math.min(start.col, end.col);
            const maxC = Math.max(start.col, end.col);
            const minR = Math.min(start.row, end.row);
            const maxR = Math.max(start.row, end.row);
            const cells = new Set<string>();
            for (let r = minR; r <= maxR; r++) {
              for (let c = minC; c <= maxC; c++) {
                cells.add(`${r},${c}`);
              }
            }
            setSelection({
              cells,
              bounds: { minRow: minR, maxRow: maxR, minCol: minC, maxCol: maxC },
            });
          }
        } else if (mode === 'lasso') {
          const points = lassoPointsRef.current;
          if (points.length > 2) {
            // Rasterize the lasso polygon to find contained cells
            const cells = new Set<string>();
            // Find bounding box
            let minC = Infinity, maxC = -Infinity, minR = Infinity, maxR = -Infinity;
            for (const p of points) {
              if (p.col < minC) minC = p.col;
              if (p.col > maxC) maxC = p.col;
              if (p.row < minR) minR = p.row;
              if (p.row > maxR) maxR = p.row;
            }
            // Point-in-polygon test for each cell in bounding box
            for (let r = minR; r <= maxR; r++) {
              for (let c = minC; c <= maxC; c++) {
                if (pointInPolygon(c + 0.5, r + 0.5, points)) {
                  cells.add(`${r},${c}`);
                }
              }
            }
            if (cells.size > 0) {
              setSelection({
                cells,
                bounds: { minRow: minR, maxRow: maxR, minCol: minC, maxCol: maxC },
              });
            }
          }
        }
        setIsSelectDragging(false);
        setSelectStart(null);
        setSelectEnd(null);
        setLassoPoints([]);
        return;
      }
    }

    // Finalize shape drawing
    const startCell = shapeStartRef.current;
    if (isDrawingRef.current && startCell && (currentTool === 'line' || currentTool === 'rect' || currentTool === 'circle')) {
      const endCell = getGridCell(e.clientX, e.clientY);
      if (endCell) {
        const currentSelectedColor = selectedColorRef.current;
        if (currentSelectedColor) {
          const value: MappedPixel = { key: currentSelectedColor.key, color: currentSelectedColor.hex, isExternal: false };
          let shapeCells: { col: number; row: number }[] = [];
          if (currentTool === 'line') {
            shapeCells = linePixels(startCell.col, startCell.row, endCell.col, endCell.row);
          } else if (currentTool === 'rect') {
            shapeCells = rectPixels(startCell.col, startCell.row, endCell.col, endCell.row, false);
          } else if (currentTool === 'circle') {
            const dx = endCell.col - startCell.col;
            const dy = endCell.row - startCell.row;
            const radius = Math.round(Math.sqrt(dx * dx + dy * dy));
            shapeCells = circlePixels(startCell.col, startCell.row, radius, false);
          }
          const currentPixels = pixelsRef.current;
          const next = paintCells(currentPixels, dims, shapeCells, value);
          if (next !== currentPixels) setPixels(next);
        }
      }
    }

    isPanningRef.current = false;
    panStartRef.current = null;
    isDrawingRef.current = false;
    shapeStartRef.current = null;
    setIsPanning(false);
    setPanStart(null);
    setIsDrawing(false);
    setShapeStart(null);
  }, [getGridCell, dims, setPixels, setSelection, commitFloating]);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const currentZoom = zoomRef.current;
      const currentPanOffset = panOffsetRef.current;

      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      const newZoom = Math.max(0.1, Math.min(20, currentZoom * factor));

      // Zoom towards mouse position
      const wx = (mx - currentPanOffset.x) / currentZoom;
      const wy = (my - currentPanOffset.y) / currentZoom;
      setPanOffset({
        x: mx - wx * newZoom,
        y: my - wy * newZoom,
      });
      setZoom(newZoom);
    },
    [setZoom, setPanOffset]
  );

  // ---- Cursor style ----
  const cursorClass = useMemo(() => {
    switch (activeTool) {
      case 'pencil': return 'cursor-pencil';
      case 'eraser': return 'cursor-eraser';
      case 'fill': return 'cursor-fill';
      case 'eyedropper': return 'cursor-eyedropper';
      case 'move': return 'cursor-move';
      case 'select': return 'cursor-crosshair';
      default: return 'cursor-default';
    }
  }, [activeTool]);

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 ${cursorClass}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => {
        isPanningRef.current = false;
        panStartRef.current = null;
        isDrawingRef.current = false;
        shapeStartRef.current = null;
        setIsPanning(false);
        setPanStart(null);
        setIsDrawing(false);
        setShapeStart(null);
        setHoverCell(null);
        setIsSelectDragging(false);
        setIsMovingSelection(false);
        setIsMovingFloating(false);
      }}
      onWheel={handleWheel}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Layer 1: Static Grid + Colors */}
      <canvas
        ref={gridRef}
        className="absolute inset-0 pointer-events-none"
      />
      {/* Layer 2: Interaction (hover, selection) */}
      <canvas
        ref={interRef}
        className="absolute inset-0 pointer-events-none"
      />

      {/* Empty state */}
      {pixels.length > 0 && pixels.every((row) => row.every((c) => c.isExternal)) && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center text-text-dim">
            <p className="text-lg mb-2">🎨</p>
            <p className="text-sm">导入图片或使用画笔开始创作</p>
            <p className="text-xs mt-1">按 Ctrl+I 导入 | 滚轮缩放 | 中键拖拽</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Square grid drawing ----

function drawSquareGrid(
  ctx: CanvasRenderingContext2D,
  pixels: MappedPixel[][],
  dims: GridDimensions,
  cellSize: number,
  showGrid: boolean,
  boldEvery: number,
  previewMode: string
) {
  const { N, M } = dims;
  const isBeadView = previewMode === 'beadView';

  // Draw background for bead view
  if (isBeadView) {
    ctx.fillStyle = '#e8e0d4';
    ctx.fillRect(0, 0, N * cellSize, M * cellSize);

    // Draw pegboard dots
    ctx.fillStyle = '#d4ccc0';
    for (let j = 0; j < M; j++) {
      for (let i = 0; i < N; i++) {
        const cx = i * cellSize + cellSize / 2;
        const cy = j * cellSize + cellSize / 2;
        ctx.beginPath();
        ctx.arc(cx, cy, cellSize * 0.06, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Rounded corner radius for pixel blocks
  const cornerR = cellSize * 0.15;

  // Draw cells / beads
  for (let j = 0; j < M; j++) {
    for (let i = 0; i < N; i++) {
      const cell = pixels[j]?.[i];

      if (isBeadView) {
        // Bead rendering: only draw beads for non-transparent cells
        if (cell && !cell.isExternal && cell.key !== TRANSPARENT_KEY) {
          const cx = i * cellSize + cellSize / 2;
          const cy = j * cellSize + cellSize / 2;
          drawBead(ctx, cx, cy, cellSize / 2, cell.color);
        }
      } else {
        // Standard flat rendering with rounded corners
        if (previewMode === 'gridOnly') {
          ctx.fillStyle = '#1e1e2e';
        } else if (cell && !cell.isExternal && cell.key !== TRANSPARENT_KEY) {
          ctx.fillStyle = cell.color;
        } else {
          const isEven = (i + j) % 2 === 0;
          ctx.fillStyle = isEven ? '#2a2a3c' : '#252536';
        }
        const x = i * cellSize;
        const y = j * cellSize;
        const gap = cellSize * 0.06; // small gap between rounded blocks
        ctx.beginPath();
        ctx.roundRect(x + gap, y + gap, cellSize - gap * 2, cellSize - gap * 2, cornerR);
        ctx.fill();
      }
    }
  }

  // Draw grid lines (skip for bead view — beads have their own outlines)
  if (showGrid && !isBeadView) {
    // Helper: parse hex "#RRGGBB" → {r,g,b}
    const parseHex = (hex: string) => {
      const h = hex.replace('#', '');
      return {
        r: parseInt(h.substring(0, 2), 16) || 0,
        g: parseInt(h.substring(2, 4), 16) || 0,
        b: parseInt(h.substring(4, 6), 16) || 0,
      };
    };
    // Get cell color or default dark background
    const cellRgb = (r: number, c: number) => {
      const px = pixels[r]?.[c];
      if (px && !px.isExternal && px.key !== TRANSPARENT_KEY) return parseHex(px.color);
      return { r: 37, g: 37, b: 54 }; // #252536 default bg
    };
    // Invert of average → bold line color
    const invertAvg = (a: {r:number;g:number;b:number}, b: {r:number;g:number;b:number}) => {
      const mr = 255 - Math.round((a.r + b.r) / 2);
      const mg = 255 - Math.round((a.g + b.g) / 2);
      const mb = 255 - Math.round((a.b + b.b) / 2);
      return `rgb(${mr},${mg},${mb})`;
    };

    // Normal (non-bold) grid lines
    ctx.strokeStyle = 'rgba(205, 214, 244, 0.08)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= N; i++) {
      if (i % boldEvery === 0) continue;
      ctx.beginPath();
      ctx.moveTo(i * cellSize, 0);
      ctx.lineTo(i * cellSize, M * cellSize);
      ctx.stroke();
    }
    for (let j = 0; j <= M; j++) {
      if (j % boldEvery === 0) continue;
      ctx.beginPath();
      ctx.moveTo(0, j * cellSize);
      ctx.lineTo(N * cellSize, j * cellSize);
      ctx.stroke();
    }

    // Bold grid lines — color derived from adjacent cells
    ctx.lineWidth = 1.5;
    for (let i = 0; i <= N; i++) {
      if (i % boldEvery !== 0) continue;
      // Draw segments per row so each segment can have its own color
      for (let j = 0; j < M; j++) {
        const left = cellRgb(j, Math.max(0, i - 1));
        const right = cellRgb(j, Math.min(N - 1, i));
        ctx.strokeStyle = invertAvg(left, right);
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.moveTo(i * cellSize, j * cellSize);
        ctx.lineTo(i * cellSize, (j + 1) * cellSize);
        ctx.stroke();
      }
    }
    for (let j = 0; j <= M; j++) {
      if (j % boldEvery !== 0) continue;
      for (let i = 0; i < N; i++) {
        const top = cellRgb(Math.max(0, j - 1), i);
        const bottom = cellRgb(Math.min(M - 1, j), i);
        ctx.strokeStyle = invertAvg(top, bottom);
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.moveTo(i * cellSize, j * cellSize);
        ctx.lineTo((i + 1) * cellSize, j * cellSize);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }
}

// ---- Hex grid drawing ----

function drawHexGrid(
  ctx: CanvasRenderingContext2D,
  pixels: MappedPixel[][],
  dims: GridDimensions,
  cellSize: number,
  showGrid: boolean,
  previewMode: string
) {
  const { N, M } = dims;
  const hexR = cellSize * 0.6;

  for (let j = 0; j < M; j++) {
    for (let i = 0; i < N; i++) {
      const center = hexCellCenter(i, j, hexR);
      const cell = pixels[j]?.[i];

      drawHexPath(ctx, center.x, center.y, hexR);

      if (previewMode === 'gridOnly') {
        ctx.fillStyle = '#1e1e2e';
      } else if (cell && !cell.isExternal && cell.key !== TRANSPARENT_KEY) {
        ctx.fillStyle = cell.color;
      } else {
        const isEven = (i + j) % 2 === 0;
        ctx.fillStyle = isEven ? '#2a2a3c' : '#252536';
      }
      ctx.fill();

      if (showGrid) {
        ctx.strokeStyle = 'rgba(205, 214, 244, 0.15)';
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
    }
  }
}
