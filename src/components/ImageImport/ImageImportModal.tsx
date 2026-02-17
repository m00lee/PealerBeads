import { useState, useRef, useCallback, useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { calculatePixelGrid, hexToRgb } from '@/lib/pixelation';
import { floydSteinbergDither, bayerDither } from '@/lib/dithering';
import {
  aiRemoveBackground,
  autoRemoveBackground,
  magicWandContiguous,
  magicWandGlobal,
  applyMaskToImageData,
  mergeSelection,
  paintMaskBrush,
  refineMask,
  createFullMask,
  imageDataToMask,
} from '@/lib/backgroundRemoval';
import { TRANSPARENT_KEY, transparentPixel } from '@/lib/pixelEditing';
import type { MappedPixel, PixelationMode, DitherAlgorithm } from '@/types';
import {
  X, Upload, ImageIcon, RotateCcw, FlipHorizontal, FlipVertical,
  Crop, SlidersHorizontal, Scissors, Wand2, Paintbrush, Eraser,
  RotateCw, Sparkles, Target, RefreshCw,
} from 'lucide-react';

// ---- Image adjustment helpers ----

function applyAdjustments(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  brightness: number,    // -100 to 100
  contrast: number,      // -100 to 100
  saturation: number,    // -100 to 100
  hueRotate: number,     // 0 to 360
  grayscale: number,     // 0 to 100
) {
  const imageData = ctx.getImageData(0, 0, width, height);
  const d = imageData.data;

  // Pre-compute contrast & brightness factors
  const cf = (259 * (contrast + 255)) / (255 * (259 - contrast));
  const bf = brightness / 100;

  for (let i = 0; i < d.length; i += 4) {
    let r = d[i], g = d[i + 1], b = d[i + 2];

    // Brightness
    r = Math.min(255, Math.max(0, r + bf * 255));
    g = Math.min(255, Math.max(0, g + bf * 255));
    b = Math.min(255, Math.max(0, b + bf * 255));

    // Contrast
    r = Math.min(255, Math.max(0, cf * (r - 128) + 128));
    g = Math.min(255, Math.max(0, cf * (g - 128) + 128));
    b = Math.min(255, Math.max(0, cf * (b - 128) + 128));

    // Saturation & Hue rotation via HSL
    if (saturation !== 0 || hueRotate !== 0 || grayscale > 0) {
      // RGB to HSL
      const rn = r / 255, gn = g / 255, bn = b / 255;
      const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
      let h = 0, s = 0;
      const l = (max + min) / 2;

      if (max !== min) {
        const d2 = max - min;
        s = l > 0.5 ? d2 / (2 - max - min) : d2 / (max + min);
        if (max === rn) h = ((gn - bn) / d2 + (gn < bn ? 6 : 0)) / 6;
        else if (max === gn) h = ((bn - rn) / d2 + 2) / 6;
        else h = ((rn - gn) / d2 + 4) / 6;
      }

      // Adjust saturation
      let newS = s * (1 + saturation / 100);
      newS = Math.max(0, Math.min(1, newS));

      // Hue rotation
      let newH = h + hueRotate / 360;
      if (newH > 1) newH -= 1;
      if (newH < 0) newH += 1;

      // Grayscale blend
      const gs = grayscale / 100;
      newS = newS * (1 - gs);

      // HSL back to RGB
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };

      if (newS === 0) {
        r = g = b = Math.round(l * 255);
      } else {
        const q2 = l < 0.5 ? l * (1 + newS) : l + newS - l * newS;
        const p2 = 2 * l - q2;
        r = Math.round(hue2rgb(p2, q2, newH + 1 / 3) * 255);
        g = Math.round(hue2rgb(p2, q2, newH) * 255);
        b = Math.round(hue2rgb(p2, q2, newH - 1 / 3) * 255);
      }
    }

    d[i] = r;
    d[i + 1] = g;
    d[i + 2] = b;
  }

  ctx.putImageData(imageData, 0, 0);
}

export function ImageImportModal() {
  const {
    setShowImportModal,
    gridDimensions: dims,
    palette,
    pixelationMode,
    ditherAlgorithm,
    ditherStrength,
    setPixels,
    setSourceImage,
    setSourceImageData,
    canvasMode,
    ensureGridSize,
    pixels: currentGridPixels,
  } = useStore();

  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [rotation, setRotation] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [loading, setLoading] = useState(false);

  // Crop state (relative 0-1 coordinates)
  const [cropMode, setCropMode] = useState(false);
  const [cropRect, setCropRect] = useState({ x: 0, y: 0, w: 1, h: 1 });
  const [cropDragging, setCropDragging] = useState<string | null>(null);
  const [cropDragStart, setCropDragStart] = useState({ mx: 0, my: 0, rect: { x: 0, y: 0, w: 1, h: 1 } });

  // Adjustment state
  const [showAdjust, setShowAdjust] = useState(false);
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [saturation, setSaturation] = useState(0);
  const [hueRotate, setHueRotate] = useState(0);
  const [grayscale, setGrayscale] = useState(0);

  // Cutout state
  const [cutoutMode, setCutoutMode] = useState(false);
  const [cutoutMask, setCutoutMask] = useState<boolean[][] | null>(null);
  const [cutoutTool, setCutoutTool] = useState<'magicWand' | 'brushErase' | 'brushRestore'>('magicWand');
  const [cutoutTolerance, setCutoutTolerance] = useState(30);
  const [cutoutContiguous, setCutoutContiguous] = useState(true);
  const [cutoutBrushSize, setCutoutBrushSize] = useState(10);
  const [cutoutLoading, setCutoutLoading] = useState(false);
  const [cutoutProgress, setCutoutProgress] = useState(0);
  /** The baked ImageData (after transform+crop+adjust) that cutout tools work on */
  const [cutoutImageData, setCutoutImageData] = useState<ImageData | null>(null);
  const [maskHistory, setMaskHistory] = useState<boolean[][][]>([]);
  const isBrushing = useRef(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cropContainerRef = useRef<HTMLDivElement>(null);
  const cutoutCanvasRef = useRef<HTMLCanvasElement>(null);

  const handleFile = useCallback((file: File) => {
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      alert('不支持的文件格式，请使用 JPG/PNG/WebP/GIF');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        setImage(img);
        setPreview(e.target?.result as string);
        setCropRect({ x: 0, y: 0, w: 1, h: 1 });
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  // ---- Crop mouse handling ----
  const handleCropMouseDown = useCallback((e: React.MouseEvent, handle: string) => {
    e.stopPropagation();
    e.preventDefault();
    setCropDragging(handle);
    setCropDragStart({ mx: e.clientX, my: e.clientY, rect: { ...cropRect } });
  }, [cropRect]);

  useEffect(() => {
    if (!cropDragging) return;
    const handleMove = (e: MouseEvent) => {
      const container = cropContainerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const dx = (e.clientX - cropDragStart.mx) / rect.width;
      const dy = (e.clientY - cropDragStart.my) / rect.height;
      const orig = cropDragStart.rect;

      let nx = orig.x, ny = orig.y, nw = orig.w, nh = orig.h;

      if (cropDragging === 'move') {
        nx = Math.max(0, Math.min(1 - orig.w, orig.x + dx));
        ny = Math.max(0, Math.min(1 - orig.h, orig.y + dy));
      } else if (cropDragging === 'tl') {
        nx = Math.max(0, Math.min(orig.x + orig.w - 0.05, orig.x + dx));
        ny = Math.max(0, Math.min(orig.y + orig.h - 0.05, orig.y + dy));
        nw = orig.x + orig.w - nx;
        nh = orig.y + orig.h - ny;
      } else if (cropDragging === 'tr') {
        nw = Math.max(0.05, Math.min(1 - orig.x, orig.w + dx));
        ny = Math.max(0, Math.min(orig.y + orig.h - 0.05, orig.y + dy));
        nh = orig.y + orig.h - ny;
      } else if (cropDragging === 'bl') {
        nx = Math.max(0, Math.min(orig.x + orig.w - 0.05, orig.x + dx));
        nw = orig.x + orig.w - nx;
        nh = Math.max(0.05, Math.min(1 - orig.y, orig.h + dy));
      } else if (cropDragging === 'br') {
        nw = Math.max(0.05, Math.min(1 - orig.x, orig.w + dx));
        nh = Math.max(0.05, Math.min(1 - orig.y, orig.h + dy));
      }

      setCropRect({ x: nx, y: ny, w: nw, h: nh });
    };
    const handleUp = () => setCropDragging(null);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [cropDragging, cropDragStart]);

  const resetAdjustments = useCallback(() => {
    setBrightness(0);
    setContrast(0);
    setSaturation(0);
    setHueRotate(0);
    setGrayscale(0);
  }, []);

  // ---- Cutout helpers ----

  /** Bake current transform+crop+adjust into ImageData for cutout operations */
  const prepareCutoutImageData = useCallback((): ImageData | null => {
    if (!image) return null;
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d')!;
    const isRotated = rotation === 90 || rotation === 270;
    tempCanvas.width = isRotated ? image.height : image.width;
    tempCanvas.height = isRotated ? image.width : image.height;
    tempCtx.save();
    tempCtx.translate(tempCanvas.width / 2, tempCanvas.height / 2);
    tempCtx.rotate((rotation * Math.PI) / 180);
    if (flipH) tempCtx.scale(-1, 1);
    if (flipV) tempCtx.scale(1, -1);
    tempCtx.drawImage(image, -image.width / 2, -image.height / 2);
    tempCtx.restore();

    const cw = Math.round(tempCanvas.width * cropRect.w);
    const ch = Math.round(tempCanvas.height * cropRect.h);
    const cx = Math.round(tempCanvas.width * cropRect.x);
    const cy = Math.round(tempCanvas.height * cropRect.y);
    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = cw;
    cropCanvas.height = ch;
    const cropCtx = cropCanvas.getContext('2d')!;
    cropCtx.drawImage(tempCanvas, cx, cy, cw, ch, 0, 0, cw, ch);

    const hasAdj = brightness !== 0 || contrast !== 0 || saturation !== 0 || hueRotate !== 0 || grayscale > 0;
    if (hasAdj) applyAdjustments(cropCtx, cw, ch, brightness, contrast, saturation, hueRotate, grayscale);

    return cropCtx.getImageData(0, 0, cw, ch);
  }, [image, rotation, flipH, flipV, cropRect, brightness, contrast, saturation, hueRotate, grayscale]);

  const enterCutoutMode = useCallback(() => {
    const imgData = prepareCutoutImageData();
    if (!imgData) return;
    setCutoutImageData(imgData);
    setCutoutMask(createFullMask(imgData.width, imgData.height));
    setMaskHistory([]);
    setCutoutMode(true);
    setCropMode(false);
    setShowAdjust(false);
  }, [prepareCutoutImageData]);

  const exitCutoutMode = useCallback(() => {
    setCutoutMode(false);
  }, []);

  const pushMaskHistory = useCallback((mask: boolean[][]) => {
    setMaskHistory((prev) => [...prev.slice(-20), mask]);
  }, []);

  const undoCutout = useCallback(() => {
    setMaskHistory((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setCutoutMask(last);
      return prev.slice(0, -1);
    });
  }, []);

  const resetCutout = useCallback(() => {
    if (!cutoutImageData) return;
    setCutoutMask(createFullMask(cutoutImageData.width, cutoutImageData.height));
    setMaskHistory([]);
  }, [cutoutImageData]);

  /** AI-powered background removal */
  const doCutoutAI = useCallback(async () => {
    if (!image || !cutoutImageData) return;
    setCutoutLoading(true);
    setCutoutProgress(0);
    try {
      // Create a blob from the current image data
      const canvas = document.createElement('canvas');
      canvas.width = cutoutImageData.width;
      canvas.height = cutoutImageData.height;
      canvas.getContext('2d')!.putImageData(cutoutImageData, 0, 0);
      const blob = await new Promise<Blob>((resolve) =>
        canvas.toBlob((b) => resolve(b!), 'image/png')
      );

      if (cutoutMask) pushMaskHistory(cutoutMask);

      const resultImageData = await aiRemoveBackground(blob, (p) => setCutoutProgress(p));
      const state = imageDataToMask(resultImageData);
      setCutoutMask(state.mask);
    } catch (err) {
      console.error('AI背景移除失败:', err);
      alert('AI抠图失败，正在使用自动检测模式...');
      doCutoutAuto();
    } finally {
      setCutoutLoading(false);
      setCutoutProgress(0);
    }
  }, [image, cutoutImageData, cutoutMask, pushMaskHistory]);

  /** Algorithmic background removal (edge flood fill) */
  const doCutoutAuto = useCallback(() => {
    if (!cutoutImageData) return;
    if (cutoutMask) pushMaskHistory(cutoutMask);
    const result = autoRemoveBackground(cutoutImageData, cutoutTolerance);
    setCutoutMask(result.mask);
  }, [cutoutImageData, cutoutTolerance, cutoutMask, pushMaskHistory]);

  /** Edge refinement */
  const doRefine = useCallback((op: 'erode' | 'dilate') => {
    if (!cutoutMask) return;
    pushMaskHistory(cutoutMask);
    setCutoutMask(refineMask(cutoutMask, op, 1));
  }, [cutoutMask, pushMaskHistory]);

  // ---- Draw cutout preview ----

  useEffect(() => {
    if (!cutoutMode || !cutoutImageData || !cutoutMask) return;
    const canvas = cutoutCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const { width, height } = cutoutImageData;
    canvas.width = width;
    canvas.height = height;

    // Checkerboard background
    const checker = 8;
    for (let y = 0; y < height; y += checker) {
      for (let x = 0; x < width; x += checker) {
        const even = ((Math.floor(x / checker) + Math.floor(y / checker)) % 2) === 0;
        ctx.fillStyle = even ? '#e0e0e0' : '#ffffff';
        ctx.fillRect(x, y, checker, checker);
      }
    }

    // Draw masked image
    const maskedData = applyMaskToImageData(cutoutImageData, cutoutMask);
    const tmpCanvas = document.createElement('canvas');
    tmpCanvas.width = width;
    tmpCanvas.height = height;
    tmpCanvas.getContext('2d')!.putImageData(maskedData, 0, 0);
    ctx.drawImage(tmpCanvas, 0, 0);
  }, [cutoutMode, cutoutImageData, cutoutMask]);

  // ---- Cutout canvas mouse handlers ----

  const getCutoutCoords = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = cutoutCanvasRef.current;
    if (!canvas || !cutoutImageData) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = cutoutImageData.width / rect.width;
    const scaleY = cutoutImageData.height / rect.height;
    return {
      x: Math.floor((e.clientX - rect.left) * scaleX),
      y: Math.floor((e.clientY - rect.top) * scaleY),
    };
  }, [cutoutImageData]);

  const handleCutoutMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!cutoutMask || !cutoutImageData) return;
    const coords = getCutoutCoords(e);
    if (!coords) return;
    const { x, y } = coords;

    if (cutoutTool === 'magicWand') {
      pushMaskHistory(cutoutMask);
      const selection = cutoutContiguous
        ? magicWandContiguous(cutoutImageData, x, y, cutoutTolerance)
        : magicWandGlobal(cutoutImageData, x, y, cutoutTolerance);
      setCutoutMask(mergeSelection(cutoutMask, selection, 'remove'));
    } else if (cutoutTool === 'brushErase' || cutoutTool === 'brushRestore') {
      pushMaskHistory(cutoutMask);
      isBrushing.current = true;
      const value = cutoutTool === 'brushRestore';
      setCutoutMask(paintMaskBrush(cutoutMask, x, y, cutoutBrushSize, value));
    }
  }, [cutoutMask, cutoutImageData, getCutoutCoords, cutoutTool, cutoutContiguous, cutoutTolerance, cutoutBrushSize, pushMaskHistory]);

  const handleCutoutMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isBrushing.current || !cutoutMask || !cutoutImageData) return;
    if (cutoutTool !== 'brushErase' && cutoutTool !== 'brushRestore') return;
    const coords = getCutoutCoords(e);
    if (!coords) return;
    const value = cutoutTool === 'brushRestore';
    setCutoutMask(paintMaskBrush(cutoutMask, coords.x, coords.y, cutoutBrushSize, value));
  }, [cutoutMask, cutoutImageData, getCutoutCoords, cutoutTool, cutoutBrushSize]);

  const handleCutoutMouseUp = useCallback(() => {
    isBrushing.current = false;
  }, []);

  const processImage = useCallback(() => {
    if (!image) return;
    setLoading(true);

    requestAnimationFrame(() => {
      try {
        let imageData: ImageData;
        let cw: number, ch: number;

        if (cutoutMode && cutoutImageData && cutoutMask) {
          // Use the pre-baked cutout image data with mask applied
          imageData = applyMaskToImageData(cutoutImageData, cutoutMask);
          cw = cutoutImageData.width;
          ch = cutoutImageData.height;
        } else {
          // Normal flow: transform → crop → adjust
          const tempCanvas = document.createElement('canvas');
          const tempCtx = tempCanvas.getContext('2d')!;
          const isRotated = rotation === 90 || rotation === 270;
          tempCanvas.width = isRotated ? image.height : image.width;
          tempCanvas.height = isRotated ? image.width : image.height;
          tempCtx.save();
          tempCtx.translate(tempCanvas.width / 2, tempCanvas.height / 2);
          tempCtx.rotate((rotation * Math.PI) / 180);
          if (flipH) tempCtx.scale(-1, 1);
          if (flipV) tempCtx.scale(1, -1);
          tempCtx.drawImage(image, -image.width / 2, -image.height / 2);
          tempCtx.restore();

          cw = Math.round(tempCanvas.width * cropRect.w);
          ch = Math.round(tempCanvas.height * cropRect.h);
          const cx = Math.round(tempCanvas.width * cropRect.x);
          const cy = Math.round(tempCanvas.height * cropRect.y);
          const cropCanvas = document.createElement('canvas');
          cropCanvas.width = cw;
          cropCanvas.height = ch;
          const cropCtx = cropCanvas.getContext('2d')!;
          cropCtx.drawImage(tempCanvas, cx, cy, cw, ch, 0, 0, cw, ch);

          const hasAdj = brightness !== 0 || contrast !== 0 || saturation !== 0 || hueRotate !== 0 || grayscale > 0;
          if (hasAdj) {
            applyAdjustments(cropCtx, cw, ch, brightness, contrast, saturation, hueRotate, grayscale);
          }

          imageData = cropCtx.getImageData(0, 0, cw, ch);
        }

        let resultPixels: MappedPixel[][];

        // Create a version of imageData for pixelation with alpha-aware processing
        // For pixelation, we need a canvas to resize
        const srcCanvas = document.createElement('canvas');
        srcCanvas.width = cw;
        srcCanvas.height = ch;
        srcCanvas.getContext('2d')!.putImageData(imageData, 0, 0);

        if (ditherAlgorithm !== 'none') {
          const resizeCanvas = document.createElement('canvas');
          resizeCanvas.width = dims.N;
          resizeCanvas.height = dims.M;
          const resizeCtx = resizeCanvas.getContext('2d')!;
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
            imageData,
            cw,
            ch,
            dims.N,
            dims.M,
            palette,
            pixelationMode,
            fallback
          );
        }

        // Apply transparency from cutout: cells where source is mostly transparent → isExternal
        if (cutoutMask || (cutoutMode && cutoutImageData)) {
          const hasMask = cutoutMask;
          const cellW = cw / dims.N;
          const cellH = ch / dims.M;
          for (let r = 0; r < dims.M; r++) {
            for (let c = 0; c < dims.N; c++) {
              const startX = Math.floor(c * cellW);
              const startY = Math.floor(r * cellH);
              const endX = Math.min(cw, Math.floor((c + 1) * cellW));
              const endY = Math.min(ch, Math.floor((r + 1) * cellH));
              let transparentCount = 0, total = 0;
              for (let py = startY; py < endY; py++) {
                for (let px = startX; px < endX; px++) {
                  const idx = (py * cw + px) * 4;
                  if (imageData.data[idx + 3] < 128) transparentCount++;
                  total++;
                }
              }
              if (total > 0 && transparentCount / total > 0.5) {
                resultPixels[r][c] = { ...transparentPixel };
              }
            }
          }
        }

        // In infinite canvas mode: place imported image at top-left, preserving existing content
        if (canvasMode === 'infinite') {
          const importH = resultPixels.length;
          const importW = importH > 0 ? resultPixels[0].length : 0;
          // Ensure grid is large enough
          ensureGridSize(importW, importH);
          // Get the (possibly expanded) current grid
          const basePixels = useStore.getState().pixels;
          const mergedPixels = basePixels.map((row) => [...row]);
          // Overlay imported pixels at top-left (0,0)
          for (let r = 0; r < importH; r++) {
            for (let c = 0; c < importW; c++) {
              const px = resultPixels[r]?.[c];
              if (px && !px.isExternal && px.key !== TRANSPARENT_KEY) {
                if (mergedPixels[r]?.[c]) {
                  mergedPixels[r][c] = { ...px };
                }
              }
            }
          }
          setPixels(mergedPixels);
        } else {
          setPixels(resultPixels);
        }
        setSourceImage(image);
        setSourceImageData(imageData);
        setShowImportModal(false);
      } catch (err) {
        console.error('Image processing failed:', err);
        alert('图片处理失败，请重试');
      } finally {
        setLoading(false);
      }
    });
  }, [image, rotation, flipH, flipV, cropRect, brightness, contrast, saturation, hueRotate, grayscale, dims, palette, pixelationMode, ditherAlgorithm, ditherStrength, cutoutMode, cutoutImageData, cutoutMask, setPixels, setSourceImage, setSourceImageData, setShowImportModal, canvasMode, ensureGridSize, currentGridPixels]);

  // CSS filter preview string
  const filterStyle = [
    brightness !== 0 ? `brightness(${1 + brightness / 100})` : '',
    contrast !== 0 ? `contrast(${1 + contrast / 100})` : '',
    saturation !== 0 ? `saturate(${1 + saturation / 100})` : '',
    hueRotate !== 0 ? `hue-rotate(${hueRotate}deg)` : '',
    grayscale > 0 ? `grayscale(${grayscale}%)` : '',
  ].filter(Boolean).join(' ') || 'none';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-surface-light rounded-lg shadow-2xl w-[640px] max-h-[85vh] flex flex-col border border-surface-lighter">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-surface-lighter">
          <h2 className="text-sm font-medium text-text">导入图片</h2>
          <button
            className="text-text-muted hover:text-text p-1"
            onClick={() => setShowImportModal(false)}
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-4 overflow-y-auto">
          {!image ? (
            <div
              className="border-2 border-dashed border-surface-lighter rounded-lg p-8 text-center hover:border-accent/50 transition-colors cursor-pointer"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={32} className="mx-auto mb-3 text-text-dim" />
              <p className="text-sm text-text-muted mb-1">拖拽图片到这里，或点击选择</p>
              <p className="text-xs text-text-dim">支持 JPG / PNG / WebP / GIF</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
              />
            </div>
          ) : (
            <div className="space-y-3">
              {/* Preview area */}
              <div
                ref={cropContainerRef}
                className="bg-surface rounded-lg p-2 flex items-center justify-center min-h-[200px] relative overflow-hidden"
              >
                {cutoutMode ? (
                  /* ---- Cutout canvas preview ---- */
                  <canvas
                    ref={cutoutCanvasRef}
                    className="max-w-full max-h-[280px] object-contain block"
                    style={{
                      cursor: cutoutTool === 'magicWand'
                        ? 'crosshair'
                        : cutoutTool === 'brushErase'
                          ? 'not-allowed'
                          : 'cell',
                      imageRendering: 'auto',
                    }}
                    onMouseDown={handleCutoutMouseDown}
                    onMouseMove={handleCutoutMouseMove}
                    onMouseUp={handleCutoutMouseUp}
                    onMouseLeave={handleCutoutMouseUp}
                  />
                ) : (
                  /* ---- Normal image preview ---- */
                  <div className="relative inline-block max-w-full max-h-[280px]">
                    <img
                      src={preview!}
                      alt="Preview"
                      className="max-w-full max-h-[280px] object-contain block"
                      style={{
                        transform: `rotate(${rotation}deg) scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})`,
                        filter: filterStyle,
                      }}
                    />
                    {/* Crop overlay */}
                    {cropMode && (
                      <div className="absolute inset-0" style={{ pointerEvents: 'none' }}>
                        <div className="absolute inset-0 bg-black/50" />
                        <div
                          className="absolute border-2 border-white/80 bg-transparent"
                          style={{
                            left: `${cropRect.x * 100}%`,
                            top: `${cropRect.y * 100}%`,
                            width: `${cropRect.w * 100}%`,
                            height: `${cropRect.h * 100}%`,
                            pointerEvents: 'auto',
                            cursor: 'move',
                            boxShadow: `0 0 0 9999px rgba(0,0,0,0.5)`,
                            background: 'transparent',
                          }}
                          onMouseDown={(e) => handleCropMouseDown(e, 'move')}
                        >
                          {['tl', 'tr', 'bl', 'br'].map((pos) => (
                            <div
                              key={pos}
                              className="absolute w-3 h-3 bg-white border border-gray-400 rounded-sm"
                              style={{
                                ...(pos.includes('t') ? { top: -6 } : { bottom: -6 }),
                                ...(pos.includes('l') ? { left: -6 } : { right: -6 }),
                                cursor: pos === 'tl' || pos === 'br' ? 'nwse-resize' : 'nesw-resize',
                                pointerEvents: 'auto',
                              }}
                              onMouseDown={(e) => handleCropMouseDown(e, pos)}
                            />
                          ))}
                          <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none">
                            {Array.from({ length: 9 }).map((_, i) => (
                              <div key={i} className="border border-white/20" />
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ============ Toolbar ============ */}
              {cutoutMode ? (
                /* ---- Cutout toolbar ---- */
                <div className="flex items-center justify-center gap-1 flex-wrap">
                  {/* AI one-click */}
                  <button
                    className="px-2 py-1.5 rounded transition-colors flex items-center gap-1 bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-300 hover:from-purple-500/30 hover:to-pink-500/30 disabled:opacity-50"
                    onClick={doCutoutAI}
                    disabled={cutoutLoading}
                    title="AI智能抠图 (自动检测并移除背景)"
                  >
                    <Sparkles size={14} />
                    <span className="text-xs font-medium">
                      {cutoutLoading ? `AI处理 ${Math.round(cutoutProgress * 100)}%` : 'AI抠图'}
                    </span>
                  </button>

                  {/* Auto detect */}
                  <button
                    className="px-2 py-1.5 rounded transition-colors flex items-center gap-1 text-text-muted hover:text-text hover:bg-surface"
                    onClick={doCutoutAuto}
                    disabled={cutoutLoading}
                    title="自动检测边缘背景色并移除"
                  >
                    <Target size={14} />
                    <span className="text-xs">自动检测</span>
                  </button>

                  <div className="w-px h-5 bg-surface-lighter mx-0.5" />

                  {/* Magic Wand */}
                  <button
                    className={`p-1.5 rounded transition-colors ${cutoutTool === 'magicWand' ? 'bg-accent/20 text-accent' : 'text-text-muted hover:text-text hover:bg-surface'}`}
                    onClick={() => setCutoutTool('magicWand')}
                    title="魔术棒 (点击移除相似颜色区域)"
                  >
                    <Wand2 size={14} />
                  </button>

                  {/* Brush Erase */}
                  <button
                    className={`p-1.5 rounded transition-colors ${cutoutTool === 'brushErase' ? 'bg-accent/20 text-accent' : 'text-text-muted hover:text-text hover:bg-surface'}`}
                    onClick={() => setCutoutTool('brushErase')}
                    title="擦除笔刷 (手动擦除区域)"
                  >
                    <Eraser size={14} />
                  </button>

                  {/* Brush Restore */}
                  <button
                    className={`p-1.5 rounded transition-colors ${cutoutTool === 'brushRestore' ? 'bg-accent/20 text-accent' : 'text-text-muted hover:text-text hover:bg-surface'}`}
                    onClick={() => setCutoutTool('brushRestore')}
                    title="还原笔刷 (恢复被擦除的区域)"
                  >
                    <Paintbrush size={14} />
                  </button>

                  <div className="w-px h-5 bg-surface-lighter mx-0.5" />

                  {/* Edge refine */}
                  <button
                    className="p-1.5 rounded transition-colors text-text-muted hover:text-text hover:bg-surface"
                    onClick={() => doRefine('erode')}
                    title="收缩边缘 (去除毛边)"
                  >
                    <span className="text-[10px] font-bold leading-none">−</span>
                  </button>
                  <button
                    className="p-1.5 rounded transition-colors text-text-muted hover:text-text hover:bg-surface"
                    onClick={() => doRefine('dilate')}
                    title="膨胀边缘 (扩大选区)"
                  >
                    <span className="text-[10px] font-bold leading-none">+</span>
                  </button>

                  <div className="w-px h-5 bg-surface-lighter mx-0.5" />

                  {/* Undo */}
                  <button
                    className="p-1.5 rounded transition-colors text-text-muted hover:text-text hover:bg-surface disabled:opacity-30"
                    onClick={undoCutout}
                    disabled={maskHistory.length === 0}
                    title="撤销"
                  >
                    <RotateCcw size={14} />
                  </button>

                  {/* Reset */}
                  <button
                    className="p-1.5 rounded transition-colors text-text-muted hover:text-text hover:bg-surface"
                    onClick={resetCutout}
                    title="重置抠图"
                  >
                    <RefreshCw size={14} />
                  </button>

                  {/* Exit cutout */}
                  <button
                    className="px-2 py-1.5 rounded transition-colors flex items-center gap-1 text-orange-400 hover:bg-orange-500/10"
                    onClick={exitCutoutMode}
                    title="退出抠图模式"
                  >
                    <X size={14} />
                    <span className="text-xs">退出抠图</span>
                  </button>
                </div>
              ) : (
                /* ---- Normal transform toolbar ---- */
                <div className="flex items-center justify-center gap-1.5">
                  <button
                    className="p-2 text-text-muted hover:text-text hover:bg-surface rounded transition-colors"
                    onClick={() => setRotation((r) => (r + 90) % 360)}
                    title="旋转 90°"
                  >
                    <RotateCcw size={16} />
                  </button>
                  <button
                    className={`p-2 rounded transition-colors ${flipH ? 'bg-accent/20 text-accent' : 'text-text-muted hover:text-text hover:bg-surface'}`}
                    onClick={() => setFlipH(!flipH)}
                    title="水平翻转"
                  >
                    <FlipHorizontal size={16} />
                  </button>
                  <button
                    className={`p-2 rounded transition-colors ${flipV ? 'bg-accent/20 text-accent' : 'text-text-muted hover:text-text hover:bg-surface'}`}
                    onClick={() => setFlipV(!flipV)}
                    title="垂直翻转"
                  >
                    <FlipVertical size={16} />
                  </button>

                  <div className="w-px h-5 bg-surface-lighter mx-1" />

                  <button
                    className={`p-2 rounded transition-colors flex items-center gap-1 ${cropMode ? 'bg-accent/20 text-accent' : 'text-text-muted hover:text-text hover:bg-surface'}`}
                    onClick={() => {
                      setCropMode(!cropMode);
                      if (!cropMode) setCropRect({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 });
                      else setCropRect({ x: 0, y: 0, w: 1, h: 1 });
                    }}
                    title="裁剪"
                  >
                    <Crop size={16} />
                    <span className="text-xs">裁剪</span>
                  </button>
                  <button
                    className={`p-2 rounded transition-colors flex items-center gap-1 ${showAdjust ? 'bg-accent/20 text-accent' : 'text-text-muted hover:text-text hover:bg-surface'}`}
                    onClick={() => setShowAdjust(!showAdjust)}
                    title="色彩调节"
                  >
                    <SlidersHorizontal size={16} />
                    <span className="text-xs">调节</span>
                  </button>
                  <button
                    className="p-2 rounded transition-colors flex items-center gap-1 text-text-muted hover:text-text hover:bg-surface"
                    onClick={enterCutoutMode}
                    title="智能抠图 (移除背景)"
                  >
                    <Scissors size={16} />
                    <span className="text-xs">抠图</span>
                  </button>
                </div>
              )}

              {/* ============ Sub-panels ============ */}

              {/* Cutout settings panel */}
              {cutoutMode && (
                <div className="bg-surface rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-text">抠图设置</span>
                  </div>

                  <AdjSlider
                    label="容差"
                    value={cutoutTolerance}
                    min={1}
                    max={100}
                    onChange={setCutoutTolerance}
                  />

                  {cutoutTool === 'magicWand' && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-text-muted w-12 shrink-0">范围</span>
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={cutoutContiguous}
                          onChange={(e) => setCutoutContiguous(e.target.checked)}
                          className="accent-accent"
                        />
                        <span className="text-xs text-text-muted">仅连续区域</span>
                      </label>
                    </div>
                  )}

                  {(cutoutTool === 'brushErase' || cutoutTool === 'brushRestore') && (
                    <AdjSlider
                      label="笔刷"
                      value={cutoutBrushSize}
                      min={1}
                      max={50}
                      onChange={setCutoutBrushSize}
                    />
                  )}

                  {/* Loading progress */}
                  {cutoutLoading && (
                    <div className="mt-2">
                      <div className="h-1.5 bg-surface-lighter rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300"
                          style={{ width: `${Math.max(5, cutoutProgress * 100)}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-text-dim text-center mt-1">
                        AI模型加载中，首次使用需下载模型...
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Color adjustment panel (normal mode only) */}
              {!cutoutMode && showAdjust && (
                <div className="bg-surface rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-text">色彩调节</span>
                    <button
                      className="text-[10px] text-accent hover:text-accent-hover"
                      onClick={resetAdjustments}
                    >
                      重置
                    </button>
                  </div>

                  <AdjSlider label="亮度" value={brightness} min={-100} max={100} onChange={setBrightness} />
                  <AdjSlider label="对比度" value={contrast} min={-100} max={100} onChange={setContrast} />
                  <AdjSlider label="饱和度" value={saturation} min={-100} max={100} onChange={setSaturation} />
                  <AdjSlider label="色相" value={hueRotate} min={0} max={360} onChange={setHueRotate} />
                  <AdjSlider label="灰度" value={grayscale} min={0} max={100} onChange={setGrayscale} />
                </div>
              )}

              {/* Info */}
              <div className="text-xs text-text-dim text-center">
                原图 {image.width}×{image.height}
                {cropMode && ` → 裁剪 ${Math.round(cropRect.w * 100)}%×${Math.round(cropRect.h * 100)}%`}
                {cutoutMode && cutoutImageData && ` → 抠图 ${cutoutImageData.width}×${cutoutImageData.height}`}
                {' → '}目标网格 {dims.N}×{dims.M}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-surface-lighter">
          <button
            className="px-4 py-1.5 text-sm text-text-muted hover:text-text rounded transition-colors"
            onClick={() => setShowImportModal(false)}
          >
            取消
          </button>
          <button
            className="px-4 py-1.5 text-sm bg-accent text-surface rounded font-medium hover:bg-accent-hover transition-colors disabled:opacity-50"
            disabled={!image || loading}
            onClick={processImage}
          >
            {loading ? '处理中...' : '确认导入'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Reusable adjustment slider ----

function AdjSlider({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-text-muted w-12 shrink-0">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 accent-accent h-1"
      />
      <span className="text-xs text-text-dim w-8 text-right font-mono">{value}</span>
    </div>
  );
}
