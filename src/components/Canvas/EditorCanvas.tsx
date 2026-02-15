import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { useStore } from '@/store/useStore';
import { TRANSPARENT_KEY, floodFill, paintPixel, floodFillErase } from '@/lib/pixelEditing';
import { drawHexPath, hexCellCenter } from '@/lib/canvasUtils';
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

  // Compute cell size from container
  const cellSize = 16; // base cell size in world units

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

    ctx.save();
    ctx.translate(panOffset.x, panOffset.y);
    ctx.scale(zoom, zoom);

    const { col, row } = hoverCell;

    if (gridType === 'square') {
      // Draw hover highlight
      ctx.strokeStyle = '#89b4fa';
      ctx.lineWidth = 2 / zoom;
      ctx.strokeRect(col * cellSize, row * cellSize, cellSize, cellSize);

      // Draw brush preview
      if (brushSize > 1 && (activeTool === 'pencil' || activeTool === 'eraser')) {
        ctx.strokeStyle = 'rgba(137, 180, 250, 0.4)';
        ctx.lineWidth = 1 / zoom;
        const half = Math.floor(brushSize / 2);
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
    } else {
      // Hex hover
      const center = hexCellCenter(col, row, cellSize * 0.6);
      drawHexPath(ctx, center.x, center.y, cellSize * 0.6);
      ctx.strokeStyle = '#89b4fa';
      ctx.lineWidth = 2 / zoom;
      ctx.stroke();
    }

    ctx.restore();
  }, [hoverCell, zoom, panOffset, dims, gridType, cellSize, brushSize, activeTool]);

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

  // ---- Mouse → grid coords ----
  const getGridCell = useCallback(
    (clientX: number, clientY: number) => {
      const container = containerRef.current;
      if (!container) return null;
      const rect = container.getBoundingClientRect();
      const cx = clientX - rect.left;
      const cy = clientY - rect.top;
      const worldX = (cx - panOffset.x) / zoom;
      const worldY = (cy - panOffset.y) / zoom;

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
    [panOffset, zoom, dims, gridType, cellSize]
  );

  // ---- Apply tool at cell ----
  const applyTool = useCallback(
    (col: number, row: number, tool: ToolType) => {
      if (tool === 'pencil' && selectedColor) {
        const value: MappedPixel = { key: selectedColor.key, color: selectedColor.hex, isExternal: false };
        // Apply with brush size
        const half = Math.floor(brushSize / 2);
        let current = pixels;
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
        if (symmetry === 'horizontal' || symmetry === 'both') {
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
        if (symmetry === 'vertical' || symmetry === 'both') {
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
        if (current !== pixels) setPixels(current);
      } else if (tool === 'eraser') {
        const transparent: MappedPixel = { key: TRANSPARENT_KEY, color: '#FFFFFF', isExternal: true };
        const half = Math.floor(brushSize / 2);
        let current = pixels;
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
        if (current !== pixels) setPixels(current);
      } else if (tool === 'fill' && selectedColor) {
        const value: MappedPixel = { key: selectedColor.key, color: selectedColor.hex, isExternal: false };
        const next = floodFill(pixels, dims, row, col, value);
        setPixels(next);
      } else if (tool === 'eyedropper') {
        const cell = pixels[row]?.[col];
        if (cell && !cell.isExternal) {
          const match = palette.find((p) => p.hex.toUpperCase() === cell.color.toUpperCase());
          if (match) setSelectedColor(match);
        }
      }
    },
    [pixels, dims, selectedColor, brushSize, symmetry, setPixels, palette, setSelectedColor]
  );

  // ---- Mouse handlers ----
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 1 || (e.button === 0 && activeTool === 'move')) {
        // Middle-click or move tool → start panning
        setIsPanning(true);
        setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
        return;
      }

      if (e.button === 0) {
        const cell = getGridCell(e.clientX, e.clientY);
        if (cell) {
          setIsDrawing(true);
          applyTool(cell.col, cell.row, activeTool);
        }
      }
    },
    [activeTool, panOffset, getGridCell, applyTool]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isPanning && panStart) {
        setPanOffset({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
        return;
      }

      const cell = getGridCell(e.clientX, e.clientY);
      setHoverCell(cell);

      if (isDrawing && cell && (activeTool === 'pencil' || activeTool === 'eraser')) {
        applyTool(cell.col, cell.row, activeTool);
      }
    },
    [isPanning, panStart, isDrawing, activeTool, getGridCell, applyTool, setPanOffset]
  );

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
    setPanStart(null);
    setIsDrawing(false);
  }, []);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      const newZoom = Math.max(0.1, Math.min(20, zoom * factor));

      // Zoom towards mouse position
      const wx = (mx - panOffset.x) / zoom;
      const wy = (my - panOffset.y) / zoom;
      setPanOffset({
        x: mx - wx * newZoom,
        y: my - wy * newZoom,
      });
      setZoom(newZoom);
    },
    [zoom, panOffset, setZoom, setPanOffset]
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
      onMouseLeave={handleMouseUp}
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

  // Draw cells
  for (let j = 0; j < M; j++) {
    for (let i = 0; i < N; i++) {
      const cell = pixels[j]?.[i];
      if (previewMode === 'gridOnly') {
        ctx.fillStyle = '#1e1e2e';
      } else if (cell && !cell.isExternal && cell.key !== TRANSPARENT_KEY) {
        ctx.fillStyle = cell.color;
      } else {
        // Transparent checkerboard pattern
        const isEven = (i + j) % 2 === 0;
        ctx.fillStyle = isEven ? '#2a2a3c' : '#252536';
      }
      ctx.fillRect(i * cellSize, j * cellSize, cellSize, cellSize);
    }
  }

  // Draw grid lines
  if (showGrid) {
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
