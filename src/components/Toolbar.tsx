import { useStore, useTemporalStore } from '@/store/useStore';
import {
  FolderOpen,
  Save,
  Download,
  Upload,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Grid3X3,
  Eye,
  Image as ImageIcon,
  Grid2X2,
  Palette,
  Box,
  LayoutGrid,
  Zap,
} from 'lucide-react';
import type { PreviewMode, GridType } from '@/types';

export function Toolbar({
  onShow3D,
  onShowBoardExport,
  onShowColorOptimize,
}: {
  onShow3D: () => void;
  onShowBoardExport: () => void;
  onShowColorOptimize: () => void;
}) {
  const {
    projectName,
    zoom,
    setZoom,
    previewMode,
    setPreviewMode,
    showGridLines,
    toggleGridLines,
    gridType,
    setGridType,
    setShowImportModal,
    setShowExportPanel,
  } = useStore();
  const { undo, redo } = useTemporalStore();

  const previewModes: { mode: PreviewMode; label: string }[] = [
    { mode: 'pixelated', label: '像素图' },
    { mode: 'beadView', label: '拼豆' },
    { mode: 'colorBlock', label: '色块' },
    { mode: 'gridOnly', label: '网格' },
    { mode: 'original', label: '原图' },
  ];

  return (
    <div className="h-10 bg-surface-light border-b border-surface-lighter flex items-center px-2 gap-1 shrink-0">
      {/* Project Name */}
      <span className="text-sm text-text-muted font-medium px-2 truncate max-w-[160px]">
        {projectName}
      </span>

      <div className="w-px h-5 bg-surface-lighter mx-1" />

      {/* File Actions */}
      <ToolBtn icon={<Upload size={16} />} tooltip="导入图片" onClick={() => setShowImportModal(true)} />
      <ToolBtn icon={<Download size={16} />} tooltip="导出" onClick={() => setShowExportPanel(true)} />
      <ToolBtn icon={<LayoutGrid size={16} />} tooltip="板型分割导出" onClick={onShowBoardExport} />
      <ToolBtn icon={<Box size={16} />} tooltip="3D 预览" onClick={onShow3D} />
      <ToolBtn icon={<Zap size={16} />} tooltip="颜色优化（合并相近色）" onClick={onShowColorOptimize} />

      <div className="w-px h-5 bg-surface-lighter mx-1" />

      {/* Undo/Redo */}
      <ToolBtn icon={<Undo2 size={16} />} tooltip="撤销 (Ctrl+Z)" onClick={() => undo()} />
      <ToolBtn icon={<Redo2 size={16} />} tooltip="重做 (Ctrl+Shift+Z)" onClick={() => redo()} />

      <div className="w-px h-5 bg-surface-lighter mx-1" />

      {/* Zoom */}
      <ToolBtn icon={<ZoomOut size={16} />} tooltip="缩小" onClick={() => setZoom(zoom / 1.2)} />
      <span className="text-xs text-text-muted min-w-[40px] text-center">
        {Math.round(zoom * 100)}%
      </span>
      <ToolBtn icon={<ZoomIn size={16} />} tooltip="放大" onClick={() => setZoom(zoom * 1.2)} />

      <div className="w-px h-5 bg-surface-lighter mx-1" />

      {/* Grid Type */}
      <ToolBtn
        icon={<Grid3X3 size={16} />}
        tooltip={`网格类型：${gridType === 'square' ? '方格' : '六角'}`}
        active={gridType === 'square'}
        onClick={() => setGridType(gridType === 'square' ? 'hexagonal' : 'square')}
      />

      {/* Grid Lines */}
      <ToolBtn
        icon={<Grid2X2 size={16} />}
        tooltip="显示网格线"
        active={showGridLines}
        onClick={toggleGridLines}
      />

      <div className="w-px h-5 bg-surface-lighter mx-1" />

      {/* Preview Modes */}
      {previewModes.map((pm) => (
        <button
          key={pm.mode}
          className={`px-2 py-1 text-xs rounded transition-colors ${
            previewMode === pm.mode
              ? 'bg-accent/20 text-accent'
              : 'text-text-muted hover:bg-surface-lighter hover:text-text'
          }`}
          onClick={() => setPreviewMode(pm.mode)}
          title={pm.label}
        >
          {pm.label}
        </button>
      ))}

      <div className="flex-1" />

      {/* Right side — grid dimensions */}
      <GridSizeDisplay />
    </div>
  );
}

function GridSizeDisplay() {
  const dims = useStore((s) => s.gridDimensions);
  return (
    <span className="text-xs text-text-dim px-2">
      {dims.N} × {dims.M}
    </span>
  );
}

function ToolBtn({
  icon,
  tooltip,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  tooltip: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      className={`p-1.5 rounded transition-colors ${
        active
          ? 'bg-accent/20 text-accent'
          : 'text-text-muted hover:bg-surface-lighter hover:text-text'
      }`}
      onClick={onClick}
      title={tooltip}
    >
      {icon}
    </button>
  );
}
