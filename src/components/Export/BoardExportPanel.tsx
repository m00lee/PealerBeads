// ============================================================
// PealerBeads - Board Export Panel (规则化板型分割导出)
// ============================================================

import { useState, useMemo } from 'react';
import { useStore } from '@/store/useStore';
import {
  BOARD_PRESETS,
  STACKING_OPTIONS,
  calculateBoardPages,
  renderBoardOverview,
  downloadBoardPages,
} from '@/lib/boardExport';
import { assignSymbols } from '@/lib/exportUtils';
import { X, Download, Grid3X3, Layers, Eye } from 'lucide-react';
import type { BoardSizePreset, BoardStacking } from '@/types';

export function BoardExportPanel({ onClose }: { onClose: () => void }) {
  const { pixels, gridDimensions: dims, getColorStats, projectName } = useStore();
  const stats = getColorStats();

  const [selectedPreset, setSelectedPreset] = useState<BoardSizePreset>(BOARD_PRESETS[4]); // 28×28
  const [stacking, setStacking] = useState<BoardStacking>('standard');
  const [cellSize, setCellSize] = useState(20);
  const [showGrid, setShowGrid] = useState(true);
  const [showSymbols, setShowSymbols] = useState(false);
  const [showBoardBorders, setShowBoardBorders] = useState(true);
  const [showPageNumbers, setShowPageNumbers] = useState(true);
  const [beadMode, setBeadMode] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const pages = useMemo(
    () => calculateBoardPages(dims, selectedPreset, stacking),
    [dims, selectedPreset, stacking]
  );

  const handlePreview = () => {
    const overview = renderBoardOverview(
      pixels, dims, pages, selectedPreset,
      Math.min(cellSize, 10), beadMode
    );
    const url = overview.toDataURL('image/png');
    setPreviewUrl(url);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await downloadBoardPages(pixels, dims, stats, {
        boardSize: selectedPreset,
        stacking,
        showBoardBorders,
        showPageNumbers,
        showLegend: false,
        cellSize,
        showSymbols,
        showGrid,
      }, projectName || 'pealer-beads');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-surface-light rounded-lg shadow-2xl w-[520px] max-h-[90vh] overflow-y-auto border border-surface-lighter">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-surface-lighter sticky top-0 bg-surface-light z-10">
          <div className="flex items-center gap-2">
            <Grid3X3 size={16} className="text-accent" />
            <h2 className="text-sm font-medium text-text">板型分割导出</h2>
          </div>
          <button className="text-text-muted hover:text-text p-1" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Board Size Selection */}
          <div>
            <h3 className="text-xs font-medium text-text-muted mb-2 uppercase tracking-wider">
              板型尺寸
            </h3>
            <div className="grid grid-cols-4 gap-1.5">
              {BOARD_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  className={`px-2 py-1.5 text-xs rounded border transition-all ${
                    selectedPreset.label === preset.label
                      ? 'border-accent bg-accent/15 text-accent font-medium'
                      : 'border-surface-lighter text-text-muted hover:border-text-dim hover:text-text'
                  }`}
                  onClick={() => setSelectedPreset(preset)}
                >
                  {preset.cols}×{preset.rows}
                </button>
              ))}
            </div>
          </div>

          {/* Stacking Mode */}
          <div>
            <h3 className="text-xs font-medium text-text-muted mb-2 uppercase tracking-wider">
              堆叠方式
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {STACKING_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  className={`p-2 rounded border text-left transition-all ${
                    stacking === opt.key
                      ? 'border-accent bg-accent/10'
                      : 'border-surface-lighter hover:border-text-dim'
                  }`}
                  onClick={() => setStacking(opt.key)}
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <Layers size={12} className={stacking === opt.key ? 'text-accent' : 'text-text-muted'} />
                    <span className="text-xs font-medium text-text">{opt.label}</span>
                  </div>
                  <p className="text-[10px] text-text-dim">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Options */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            <label className="flex items-center justify-between text-xs text-text-muted">
              <span>拼豆珠样式</span>
              <input
                type="checkbox"
                checked={beadMode}
                onChange={(e) => setBeadMode(e.target.checked)}
                className="accent-accent"
              />
            </label>
            <label className="flex items-center justify-between text-xs text-text-muted">
              <span>显示网格线</span>
              <input
                type="checkbox"
                checked={showGrid}
                onChange={(e) => setShowGrid(e.target.checked)}
                className="accent-accent"
              />
            </label>
            <label className="flex items-center justify-between text-xs text-text-muted">
              <span>显示符号</span>
              <input
                type="checkbox"
                checked={showSymbols}
                onChange={(e) => setShowSymbols(e.target.checked)}
                className="accent-accent"
              />
            </label>
            <label className="flex items-center justify-between text-xs text-text-muted">
              <span>板型边框</span>
              <input
                type="checkbox"
                checked={showBoardBorders}
                onChange={(e) => setShowBoardBorders(e.target.checked)}
                className="accent-accent"
              />
            </label>
            <label className="flex items-center justify-between text-xs text-text-muted">
              <span>页码标识</span>
              <input
                type="checkbox"
                checked={showPageNumbers}
                onChange={(e) => setShowPageNumbers(e.target.checked)}
                className="accent-accent"
              />
            </label>
            <div className="flex items-center justify-between text-xs text-text-muted">
              <span>格子大小: {cellSize}px</span>
              <input
                type="range"
                min={10}
                max={40}
                value={cellSize}
                onChange={(e) => setCellSize(Number(e.target.value))}
                className="w-20 accent-accent"
              />
            </div>
          </div>

          {/* Summary */}
          <div className="bg-surface rounded-lg p-3 space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-text-muted">设计尺寸</span>
              <span className="text-text">{dims.N} × {dims.M}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-text-muted">板型尺寸</span>
              <span className="text-text">{selectedPreset.cols} × {selectedPreset.rows}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-text-muted">所需板数</span>
              <span className="text-accent font-medium">{pages.length} 块</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-text-muted">颜色数</span>
              <span className="text-text">{stats.length} 种</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-text-muted">总珠数</span>
              <span className="text-text">{stats.reduce((s, c) => s + c.count, 0)}</span>
            </div>
          </div>

          {/* Preview */}
          {previewUrl && (
            <div className="border border-surface-lighter rounded-lg overflow-hidden">
              <div className="bg-surface px-3 py-1.5 border-b border-surface-lighter flex items-center justify-between">
                <span className="text-xs text-text-muted">板型分割预览</span>
                <button
                  className="text-[10px] text-text-dim hover:text-text"
                  onClick={() => setPreviewUrl(null)}
                >
                  关闭预览
                </button>
              </div>
              <div className="p-2 bg-white/5 flex justify-center">
                <img
                  src={previewUrl}
                  alt="板型预览"
                  className="max-w-full max-h-60 object-contain"
                  style={{ imageRendering: 'pixelated' }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-surface-lighter sticky bottom-0 bg-surface-light">
          <button
            className="px-4 py-1.5 text-sm text-text-muted hover:text-text rounded border border-surface-lighter hover:bg-surface transition-colors flex items-center gap-1.5"
            onClick={handlePreview}
          >
            <Eye size={14} />
            预览
          </button>
          <div className="flex gap-2">
            <button
              className="px-4 py-1.5 text-sm text-text-muted hover:text-text rounded transition-colors"
              onClick={onClose}
            >
              取消
            </button>
            <button
              className="px-4 py-1.5 text-sm bg-accent text-surface rounded font-medium hover:bg-accent-hover transition-colors flex items-center gap-1.5 disabled:opacity-50"
              onClick={handleExport}
              disabled={exporting}
            >
              <Download size={14} />
              {exporting ? '导出中...' : `导出 ${pages.length} 页`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
