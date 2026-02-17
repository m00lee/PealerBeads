import { useState, useRef, useEffect } from 'react';
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
  Infinity,
  Info,
  X,
  ExternalLink,
  FilePlus,
  FolderOpen as FolderOpenIcon,
  SaveAll,
  Clock,
  ChevronDown,
  File,
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
  const [showAbout, setShowAbout] = useState(false);
  const [showFileMenu, setShowFileMenu] = useState(false);
  const fileMenuRef = useRef<HTMLDivElement>(null);

  const {
    projectName,
    isDirty,
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
    canvasMode,
    setCanvasMode,
    // Project file
    saveProject,
    saveProjectAs,
    openProject,
    newProject,
    recentFiles,
    openRecentFile,
  } = useStore();
  const { undo, redo } = useTemporalStore();

  // Close file menu on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (fileMenuRef.current && !fileMenuRef.current.contains(e.target as Node)) {
        setShowFileMenu(false);
      }
    };
    if (showFileMenu) {
      document.addEventListener('mousedown', handleClick);
    }
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showFileMenu]);

  const previewModes: { mode: PreviewMode; label: string }[] = [
    { mode: 'pixelated', label: '像素图' },
    { mode: 'beadView', label: '拼豆' },
    { mode: 'colorBlock', label: '色块' },
    { mode: 'gridOnly', label: '网格' },
    { mode: 'original', label: '原图' },
  ];

  return (
    <div className="h-10 bg-surface-light border-b border-surface-lighter flex items-center px-2 gap-1 shrink-0">
      {/* File Menu */}
      <div className="relative" ref={fileMenuRef}>
        <button
          className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
            showFileMenu
              ? 'bg-accent/20 text-accent'
              : 'text-text-muted hover:bg-surface-lighter hover:text-text'
          }`}
          onClick={() => setShowFileMenu(!showFileMenu)}
          title="文件"
        >
          <File size={14} />
          文件
          <ChevronDown size={12} />
        </button>

        {showFileMenu && (
          <div className="absolute top-full left-0 mt-1 w-56 bg-surface-light border border-surface-lighter rounded-lg shadow-xl z-50 py-1">
            <FileMenuItem
              icon={<FilePlus size={14} />}
              label="新建项目"
              shortcut="Ctrl+N"
              onClick={() => { setShowFileMenu(false); newProject(); }}
            />
            <FileMenuItem
              icon={<FolderOpenIcon size={14} />}
              label="打开..."
              shortcut="Ctrl+O"
              onClick={() => { setShowFileMenu(false); openProject(); }}
            />
            <div className="h-px bg-surface-lighter mx-2 my-1" />
            <FileMenuItem
              icon={<Save size={14} />}
              label="保存"
              shortcut="Ctrl+S"
              onClick={() => { setShowFileMenu(false); saveProject(); }}
            />
            <FileMenuItem
              icon={<SaveAll size={14} />}
              label="另存为..."
              shortcut="Ctrl+Shift+S"
              onClick={() => { setShowFileMenu(false); saveProjectAs(); }}
            />
            <div className="h-px bg-surface-lighter mx-2 my-1" />
            <FileMenuItem
              icon={<Upload size={14} />}
              label="导入图片..."
              shortcut="Ctrl+I"
              onClick={() => { setShowFileMenu(false); setShowImportModal(true); }}
            />
            <FileMenuItem
              icon={<Download size={14} />}
              label="导出..."
              shortcut="Ctrl+E"
              onClick={() => { setShowFileMenu(false); setShowExportPanel(true); }}
            />

            {/* Recent Files */}
            {recentFiles.length > 0 && (
              <>
                <div className="h-px bg-surface-lighter mx-2 my-1" />
                <div className="px-3 py-1 text-[10px] text-text-dim uppercase tracking-wider flex items-center gap-1">
                  <Clock size={10} />
                  最近文件
                </div>
                {recentFiles.slice(0, 5).map((f) => (
                  <button
                    key={f.path}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text-muted hover:bg-surface-lighter hover:text-text transition-colors text-left"
                    onClick={() => {
                      setShowFileMenu(false);
                      openRecentFile(f.path);
                    }}
                    title={f.path}
                  >
                    {f.thumbnail && (
                      <img src={f.thumbnail} alt="" className="w-5 h-5 rounded border border-surface-lighter object-cover" />
                    )}
                    <span className="truncate flex-1">{f.name}</span>
                  </button>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* Project Name + Dirty Indicator */}
      <span className="text-sm text-text-muted font-medium px-2 truncate max-w-[160px]" title={isDirty ? '有未保存的更改' : projectName}>
        {projectName}{isDirty ? ' *' : ''}
      </span>

      <div className="w-px h-5 bg-surface-lighter mx-1" />

      {/* File Actions */}
      <ToolBtn icon={<Save size={16} />} tooltip="保存 (Ctrl+S)" onClick={() => saveProject()} />
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

      {/* Infinite Canvas */}
      <ToolBtn
        icon={<Infinity size={16} />}
        tooltip={`图纸模式：${canvasMode === 'fixed' ? '固定（点击切换为无尽）' : '无尽（点击切换为固定）'}`}
        active={canvasMode === 'infinite'}
        onClick={() => setCanvasMode(canvasMode === 'fixed' ? 'infinite' : 'fixed')}
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

      {/* Right side — About + grid dimensions */}
      <ToolBtn icon={<Info size={16} />} tooltip="关于" onClick={() => setShowAbout(true)} />
      <GridSizeDisplay />

      {/* About Modal */}
      {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}
    </div>
  );
}

function AboutModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-surface-light rounded-xl shadow-2xl w-[360px] border border-surface-lighter p-6 flex flex-col items-center gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          className="absolute top-3 right-3 text-text-muted hover:text-text transition-colors"
          onClick={onClose}
        >
          <X size={18} />
        </button>

        {/* Logo / Title */}
        <div className="text-4xl">🫘</div>
        <h2 className="text-xl font-bold text-text">PealerBeads</h2>
        <p className="text-sm text-text-muted">拼豆图纸设计器</p>

        {/* Version */}
        <span className="text-xs bg-accent/10 text-accent px-3 py-1 rounded-full font-mono">
          v0.3.0
        </span>

        {/* Author */}
        <div className="flex flex-col items-center gap-1 mt-2">
          <span className="text-xs text-text-dim">作者</span>
          <span className="text-sm text-text font-medium">m00lee</span>
        </div>

        {/* Project Link */}
        <a
          href="https://github.com/m00lee/PealerBeads"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-sm text-accent hover:underline mt-1"
        >
          <ExternalLink size={14} />
          github.com/m00lee/PealerBeads
        </a>

        {/* Divider */}
        <div className="w-full h-px bg-surface-lighter my-1" />

        {/* Tech stack */}
        <p className="text-[10px] text-text-dim text-center leading-relaxed">
          React + TypeScript + Zustand + Canvas 2D + Three.js + Tauri
        </p>

        <button
          className="mt-2 px-6 py-1.5 bg-accent/20 text-accent text-sm rounded-lg hover:bg-accent/30 transition-colors"
          onClick={onClose}
        >
          关闭
        </button>
      </div>
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

function FileMenuItem({
  icon,
  label,
  shortcut,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  onClick: () => void;
}) {
  return (
    <button
      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text-muted hover:bg-surface-lighter hover:text-text transition-colors"
      onClick={onClick}
    >
      {icon}
      <span className="flex-1 text-left">{label}</span>
      {shortcut && (
        <span className="text-[10px] text-text-dim font-mono">{shortcut}</span>
      )}
    </button>
  );
}
