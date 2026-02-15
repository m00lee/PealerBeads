// ============================================================
// PealerBeads – Color Optimization Panel (颜色优化面板)
// ============================================================

import { useState, useMemo } from 'react';
import { useStore } from '@/store/useStore';
import {
  collectColorUsage,
  calculateMergePlan,
  getMergePreview,
  applyColorMerge,
} from '@/lib/colorOptimize';
import { X, Palette, ArrowRight, Check, AlertTriangle, Zap } from 'lucide-react';

export function ColorOptimizePanel({ onClose }: { onClose: () => void }) {
  const { pixels, setPixels, getColorStats } = useStore();
  const stats = getColorStats();

  const usage = useMemo(() => collectColorUsage(pixels), [pixels]);
  const currentColorCount = usage.length;

  const [targetCount, setTargetCount] = useState(
    Math.min(currentColorCount, Math.max(1, currentColorCount - 5))
  );
  const [applied, setApplied] = useState(false);

  const mergeResult = useMemo(
    () => calculateMergePlan(usage, targetCount),
    [usage, targetCount]
  );

  const preview = useMemo(
    () => getMergePreview(usage, targetCount),
    [usage, targetCount]
  );

  const handleApply = () => {
    const newPixels = applyColorMerge(pixels, mergeResult.mergeMap, mergeResult.mergeKeyMap);
    setPixels(newPixels);
    setApplied(true);
  };

  // Quick presets
  const presets = [
    { label: '轻度', count: Math.max(1, Math.round(currentColorCount * 0.85)) },
    { label: '中度', count: Math.max(1, Math.round(currentColorCount * 0.65)) },
    { label: '重度', count: Math.max(1, Math.round(currentColorCount * 0.45)) },
    { label: '极简', count: Math.max(1, Math.round(currentColorCount * 0.25)) },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-surface-light rounded-lg shadow-2xl w-[520px] max-h-[85vh] flex flex-col border border-surface-lighter">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-surface-lighter shrink-0">
          <div className="flex items-center gap-2">
            <Zap size={16} className="text-accent" />
            <h2 className="text-sm font-medium text-text">颜色优化</h2>
            <span className="text-[10px] px-1.5 py-0.5 bg-accent/15 text-accent rounded">
              合并相近色
            </span>
          </div>
          <button className="text-text-muted hover:text-text p-1" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Current status */}
          <div className="bg-surface rounded-lg p-3">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-text-muted">当前使用颜色</span>
              <span className="text-sm font-medium text-text">{currentColorCount} 种</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-text-muted">总珠数</span>
              <span className="text-sm text-text">
                {stats.reduce((s, c) => s + c.count, 0)}
              </span>
            </div>
          </div>

          {/* Target slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider">
                目标颜色数
              </h3>
              <span className="text-sm font-medium text-accent">{targetCount}</span>
            </div>
            <input
              type="range"
              min={1}
              max={currentColorCount}
              value={targetCount}
              onChange={(e) => {
                setTargetCount(Number(e.target.value));
                setApplied(false);
              }}
              className="w-full accent-accent"
            />
            <div className="flex justify-between text-[10px] text-text-dim mt-1">
              <span>1</span>
              <span>{currentColorCount}</span>
            </div>
          </div>

          {/* Quick Presets */}
          <div className="flex gap-2">
            {presets.map((p) => (
              <button
                key={p.label}
                className={`flex-1 py-1.5 text-xs rounded border transition-all ${
                  targetCount === p.count
                    ? 'border-accent bg-accent/15 text-accent'
                    : 'border-surface-lighter text-text-muted hover:border-text-dim'
                }`}
                onClick={() => {
                  setTargetCount(p.count);
                  setApplied(false);
                }}
              >
                {p.label} ({p.count})
              </button>
            ))}
          </div>

          {/* Merge summary */}
          {mergeResult.mergedCount > 0 && (
            <div className="bg-accent/5 border border-accent/20 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={14} className="text-accent" />
                <span className="text-xs font-medium text-accent">
                  将合并 {mergeResult.mergedCount} 种颜色
                </span>
              </div>
              <p className="text-[10px] text-text-dim">
                {mergeResult.colorsBefore} 种 → {mergeResult.colorsAfter} 种，
                已选出最接近的颜色对进行合并
              </p>
            </div>
          )}

          {/* Merge preview list */}
          {preview.length > 0 && (
            <div>
              <h3 className="text-xs font-medium text-text-muted mb-2 uppercase tracking-wider">
                合并详情 ({preview.length} 对)
              </h3>
              <div className="space-y-1 max-h-[240px] overflow-y-auto pr-1">
                {preview.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 py-1.5 px-2 rounded bg-surface text-xs"
                  >
                    {/* From */}
                    <div
                      className="w-5 h-5 rounded-sm border border-surface-lighter shrink-0"
                      style={{ backgroundColor: item.fromHex }}
                    />
                    <div className="flex flex-col min-w-0">
                      <span className="text-text-muted truncate">{item.fromKey}</span>
                      <span className="text-[9px] text-text-dim">{item.fromCount} 颗</span>
                    </div>

                    <ArrowRight size={12} className="text-text-dim shrink-0 mx-1" />

                    {/* To */}
                    <div
                      className="w-5 h-5 rounded-sm border border-surface-lighter shrink-0"
                      style={{ backgroundColor: item.toHex }}
                    />
                    <span className="text-text-muted truncate">{item.toKey}</span>

                    {/* Distance */}
                    <span className="ml-auto text-[9px] text-text-dim shrink-0">
                      Δ{item.distance.toFixed(1)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {preview.length === 0 && (
            <div className="text-center py-6 text-text-dim text-xs">
              <Check size={20} className="mx-auto mb-2 text-green-400" />
              当前颜色数已在目标范围内，无需合并
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-surface-lighter shrink-0">
          <button
            className="px-4 py-1.5 text-sm text-text-muted hover:text-text rounded transition-colors"
            onClick={onClose}
          >
            {applied ? '完成' : '取消'}
          </button>
          {!applied && mergeResult.mergedCount > 0 && (
            <button
              className="px-4 py-1.5 text-sm bg-accent text-surface rounded font-medium hover:bg-accent-hover transition-colors flex items-center gap-1.5"
              onClick={handleApply}
            >
              <Zap size={14} />
              应用合并 ({mergeResult.mergedCount} 色)
            </button>
          )}
          {applied && (
            <span className="flex items-center gap-1.5 text-sm text-green-400 font-medium px-4 py-1.5">
              <Check size={14} />
              已应用
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
