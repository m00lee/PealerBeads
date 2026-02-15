import { useState, useRef, useCallback } from 'react';
import { useStore } from '@/store/useStore';
import { calculatePixelGrid, hexToRgb } from '@/lib/pixelation';
import { floydSteinbergDither, bayerDither } from '@/lib/dithering';
import type { MappedPixel, PixelationMode, DitherAlgorithm } from '@/types';
import { X, Upload, ImageIcon, RotateCcw, FlipHorizontal, FlipVertical } from 'lucide-react';

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
  } = useStore();

  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [rotation, setRotation] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [loading, setLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasPreviewRef = useRef<HTMLCanvasElement>(null);

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

  const processImage = useCallback(() => {
    if (!image) return;
    setLoading(true);

    // Use requestAnimationFrame to allow UI to update
    requestAnimationFrame(() => {
      try {
        // Create a canvas with transformations
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d')!;

        // Apply rotation
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

        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);

        let resultPixels: MappedPixel[][];

        if (ditherAlgorithm !== 'none') {
          // Resize to target dims first
          const resizeCanvas = document.createElement('canvas');
          resizeCanvas.width = dims.N;
          resizeCanvas.height = dims.M;
          const resizeCtx = resizeCanvas.getContext('2d')!;
          resizeCtx.drawImage(tempCanvas, 0, 0, dims.N, dims.M);
          const resizedData = resizeCtx.getImageData(0, 0, dims.N, dims.M);

          const ditherFn = ditherAlgorithm === 'floyd-steinberg' ? floydSteinbergDither : bayerDither;
          const paletteResult = ditherFn(resizedData, dims.N, dims.M, palette, ditherStrength);

          resultPixels = paletteResult.map((row) =>
            row.map((pc) => ({ key: pc.key, color: pc.hex, isExternal: false }))
          );
        } else {
          // Use the core pixelation engine
          const fallback = palette[0] || { key: '?', hex: '#FFFFFF', rgb: { r: 255, g: 255, b: 255 } };
          resultPixels = calculatePixelGrid(
            imageData,
            tempCanvas.width,
            tempCanvas.height,
            dims.N,
            dims.M,
            palette,
            pixelationMode,
            fallback
          );
        }

        setPixels(resultPixels);
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
  }, [image, rotation, flipH, flipV, dims, palette, pixelationMode, ditherAlgorithm, ditherStrength, setPixels, setSourceImage, setSourceImageData, setShowImportModal]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-surface-light rounded-lg shadow-2xl w-[600px] max-h-[80vh] flex flex-col border border-surface-lighter">
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
            // Drop zone
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
            // Preview + controls
            <div className="space-y-4">
              {/* Preview */}
              <div className="bg-surface rounded-lg p-2 flex items-center justify-center min-h-[200px]">
                <img
                  src={preview!}
                  alt="Preview"
                  className="max-w-full max-h-[300px] object-contain"
                  style={{
                    transform: `rotate(${rotation}deg) scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})`,
                  }}
                />
              </div>

              {/* Transform controls */}
              <div className="flex items-center justify-center gap-2">
                <button
                  className="p-2 text-text-muted hover:text-text hover:bg-surface rounded transition-colors"
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  title="旋转 90°"
                >
                  <RotateCcw size={16} />
                </button>
                <button
                  className={`p-2 rounded transition-colors ${
                    flipH ? 'bg-accent/20 text-accent' : 'text-text-muted hover:text-text hover:bg-surface'
                  }`}
                  onClick={() => setFlipH(!flipH)}
                  title="水平翻转"
                >
                  <FlipHorizontal size={16} />
                </button>
                <button
                  className={`p-2 rounded transition-colors ${
                    flipV ? 'bg-accent/20 text-accent' : 'text-text-muted hover:text-text hover:bg-surface'
                  }`}
                  onClick={() => setFlipV(!flipV)}
                  title="垂直翻转"
                >
                  <FlipVertical size={16} />
                </button>
              </div>

              {/* Info */}
              <div className="text-xs text-text-dim text-center">
                原图 {image.width}×{image.height} → 目标网格 {dims.N}×{dims.M}
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
