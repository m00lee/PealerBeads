import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { useStore } from '@/store/useStore';
import { TRANSPARENT_KEY, floodFill, paintPixel, floodFillErase, linePixels, rectPixels, circlePixels, paintCells } from '@/lib/pixelEditing';
import { drawHexPath, hexCellCenter, drawBead } from '@/lib/canvasUtils';
import type { MappedPixel, GridDimensions, ToolType } from '@/types';

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
  } = useStore();

  const [hoverCell, setHoverCell] = useState<{ col: number; row: number } | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number } | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [shapeStart, setShapeStart] = useState<{ col: number; row: number } | null>(null);

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

    if (!hoverCell) return;

    const currentZoom = zoomRef.current;
    const currentPanOffset = panOffsetRef.current;
    const currentTool = activeToolRef.current;
    const currentBrushSize = brushSizeRef.current;

    ctx.save();
    ctx.translate(currentPanOffset.x, currentPanOffset.y);
    ctx.scale(currentZoom, currentZoom);

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
  }, [hoverCell, dims, gridType, cellSize]);

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
    [dims, setPixels, palette, setSelectedColor]
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
    [getGridCell, applyTool]
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
      if (isDrawingRef.current && cell && (currentTool === 'pencil' || currentTool === 'eraser')) {
        applyTool(cell.col, cell.row, currentTool);
      }
      // For shape tools, just update hoverCell — the interaction layer will render the preview
    },
    [getGridCell, applyTool, setPanOffset]
  );

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    // Finalize shape drawing
    const currentTool = activeToolRef.current;
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
  }, [getGridCell, dims, setPixels]);

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
        // Standard flat rendering
        if (previewMode === 'gridOnly') {
          ctx.fillStyle = '#1e1e2e';
        } else if (cell && !cell.isExternal && cell.key !== TRANSPARENT_KEY) {
          ctx.fillStyle = cell.color;
        } else {
          const isEven = (i + j) % 2 === 0;
          ctx.fillStyle = isEven ? '#2a2a3c' : '#252536';
        }
        ctx.fillRect(i * cellSize, j * cellSize, cellSize, cellSize);
      }
    }
  }

  // Draw grid lines (skip for bead view — beads have their own outlines)
  if (showGrid && !isBeadView) {
    for (let i = 0; i <= N; i++) {
      const isBold = i % boldEvery === 0;
      ctx.strokeStyle = isBold ? 'rgba(205, 214, 244, 0.3)' : 'rgba(205, 214, 244, 0.08)';
      ctx.lineWidth = isBold ? 1.5 : 0.5;
      ctx.beginPath();
      ctx.moveTo(i * cellSize, 0);
      ctx.lineTo(i * cellSize, M * cellSize);
      ctx.stroke();
    }
    for (let j = 0; j <= M; j++) {
      const isBold = j % boldEvery === 0;
      ctx.strokeStyle = isBold ? 'rgba(205, 214, 244, 0.3)' : 'rgba(205, 214, 244, 0.08)';
      ctx.lineWidth = isBold ? 1.5 : 0.5;
      ctx.beginPath();
      ctx.moveTo(0, j * cellSize);
      ctx.lineTo(N * cellSize, j * cellSize);
      ctx.stroke();
    }
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
