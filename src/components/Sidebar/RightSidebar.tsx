import { useState } from 'react';
import { useStore } from '@/store/useStore';
import { ColorPalette } from '@/components/Palette/ColorPalette';
import { ExportPanel } from '@/components/Export/ExportPanel';
import { colorSystemOptions } from '@/lib/colorSystem';
import {
  Palette,
  BarChart3,
  Download,
  Settings,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import type { ColorSystem, GridDimensions } from '@/types';

export function RightSidebar() {
  const {
    colorSystem,
    setColorSystem,
    gridDimensions,
    setGridDimensions,
    initGrid,
    showExportPanel,
    setShowExportPanel,
    getColorStats,
    pixelationMode,
    setPixelationMode,
    ditherAlgorithm,
    setDitherAlgorithm,
    ditherStrength,
    setDitherStrength,
    gridBoldEvery,
    setGridBoldEvery,
  } = useStore();

  const [section, setSection] = useState<'palette' | 'stats' | 'settings'>('palette');

  return (
    <div className="w-64 bg-surface-light border-l border-surface-lighter flex flex-col shrink-0 overflow-hidden">
      {/* Section Tabs */}
      <div className="flex border-b border-surface-lighter shrink-0">
        <TabBtn icon={<Palette size={14} />} label="调色板" active={section === 'palette'} onClick={() => setSection('palette')} />
        <TabBtn icon={<BarChart3 size={14} />} label="统计" active={section === 'stats'} onClick={() => setSection('stats')} />
        <TabBtn icon={<Settings size={14} />} label="设置" active={section === 'settings'} onClick={() => setSection('settings')} />
      </div>

      {/* Section Content */}
      <div className="flex-1 overflow-y-auto p-2">
        {section === 'palette' && <PaletteSection />}
        {section === 'stats' && <StatsSection />}
        {section === 'settings' && (
          <SettingsSection
            gridDimensions={gridDimensions}
            colorSystem={colorSystem}
            pixelationMode={pixelationMode}
            ditherAlgorithm={ditherAlgorithm}
            ditherStrength={ditherStrength}
            gridBoldEvery={gridBoldEvery}
            onChangeGrid={(d) => { setGridDimensions(d); initGrid(d); }}
            onChangeSystem={setColorSystem}
            onChangePixelation={setPixelationMode}
            onChangeDither={setDitherAlgorithm}
            onChangeDitherStrength={setDitherStrength}
            onChangeGridBold={setGridBoldEvery}
          />
        )}
      </div>

      {/* Export Button */}
      <div className="p-2 border-t border-surface-lighter shrink-0">
        <button
          className="w-full py-2 bg-accent/20 text-accent hover:bg-accent/30 rounded text-sm font-medium transition-colors flex items-center justify-center gap-2"
          onClick={() => setShowExportPanel(true)}
        >
          <Download size={14} />
          导出
        </button>
      </div>

      {/* Export Panel (overlay) */}
      {showExportPanel && <ExportPanel />}
    </div>
  );
}

function PaletteSection() {
  return (
    <div>
      <h3 className="text-xs font-medium text-text-muted mb-2 uppercase tracking-wider">调色板</h3>
      <ColorPalette />
    </div>
  );
}

function StatsSection() {
  const stats = useStore((s) => s.getColorStats());
  const total = stats.reduce((s, c) => s + c.count, 0);

  return (
    <div>
      <h3 className="text-xs font-medium text-text-muted mb-2 uppercase tracking-wider">
        颜色统计 ({stats.length} 色 / {total} 豆)
      </h3>
      <div className="space-y-1">
        {stats
          .sort((a, b) => b.count - a.count)
          .map((s) => (
            <div key={s.hex} className="flex items-center gap-2 text-xs">
              <div
                className="w-4 h-4 rounded-sm border border-surface-lighter shrink-0"
                style={{ backgroundColor: s.hex }}
              />
              <span className="text-text-muted truncate flex-1">{s.key}</span>
              <span className="text-text-dim tabular-nums">{s.count}</span>
              <span className="text-text-dim tabular-nums w-12 text-right">
                {s.percentage.toFixed(1)}%
              </span>
            </div>
          ))}
        {stats.length === 0 && (
          <p className="text-xs text-text-dim">暂无数据。请先导入图片或绘制。</p>
        )}
      </div>
    </div>
  );
}

function SettingsSection({
  gridDimensions,
  colorSystem,
  pixelationMode,
  ditherAlgorithm,
  ditherStrength,
  gridBoldEvery,
  onChangeGrid,
  onChangeSystem,
  onChangePixelation,
  onChangeDither,
  onChangeDitherStrength,
  onChangeGridBold,
}: {
  gridDimensions: GridDimensions;
  colorSystem: ColorSystem;
  pixelationMode: string;
  ditherAlgorithm: string;
  ditherStrength: number;
  gridBoldEvery: number;
  onChangeGrid: (d: GridDimensions) => void;
  onChangeSystem: (s: ColorSystem) => void;
  onChangePixelation: (m: any) => void;
  onChangeDither: (a: any) => void;
  onChangeDitherStrength: (s: number) => void;
  onChangeGridBold: (n: number) => void;
}) {
  const [cols, setCols] = useState(gridDimensions.N.toString());
  const [rows, setRows] = useState(gridDimensions.M.toString());

  const presets = [
    { label: '小板 29×29', n: 29, m: 29 },
    { label: '大板 58×58', n: 58, m: 58 },
    { label: '横板 58×29', n: 58, m: 29 },
    { label: '超大 100×100', n: 100, m: 100 },
  ];

  return (
    <div className="space-y-4">
      {/* Grid Size */}
      <div>
        <h3 className="text-xs font-medium text-text-muted mb-2 uppercase tracking-wider">网格尺寸</h3>
        <div className="flex gap-2 mb-2">
          <input
            type="number"
            value={cols}
            onChange={(e) => setCols(e.target.value)}
            onBlur={() => {
              const n = parseInt(cols) || 29;
              const m = parseInt(rows) || 29;
              setCols(n.toString());
              onChangeGrid({ N: n, M: m });
            }}
            className="w-full bg-surface text-text text-xs p-1.5 rounded border border-surface-lighter"
            min={1}
            max={500}
          />
          <span className="text-text-dim self-center">×</span>
          <input
            type="number"
            value={rows}
            onChange={(e) => setRows(e.target.value)}
            onBlur={() => {
              const n = parseInt(cols) || 29;
              const m = parseInt(rows) || 29;
              setRows(m.toString());
              onChangeGrid({ N: n, M: m });
            }}
            className="w-full bg-surface text-text text-xs p-1.5 rounded border border-surface-lighter"
            min={1}
            max={500}
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {presets.map((p) => (
            <button
              key={p.label}
              className="text-[10px] px-2 py-0.5 bg-surface rounded text-text-muted hover:bg-surface-lighter transition-colors"
              onClick={() => {
                setCols(p.n.toString());
                setRows(p.m.toString());
                onChangeGrid({ N: p.n, M: p.m });
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Color System */}
      <div>
        <h3 className="text-xs font-medium text-text-muted mb-2 uppercase tracking-wider">色号系统</h3>
        <select
          value={colorSystem}
          onChange={(e) => onChangeSystem(e.target.value as ColorSystem)}
          className="w-full bg-surface text-text text-xs p-1.5 rounded border border-surface-lighter"
        >
          {colorSystemOptions.map((o) => (
            <option key={o.key} value={o.key}>
              {o.name}
            </option>
          ))}
        </select>
      </div>

      {/* Pixelation Mode */}
      <div>
        <h3 className="text-xs font-medium text-text-muted mb-2 uppercase tracking-wider">像素化模式</h3>
        <select
          value={pixelationMode}
          onChange={(e) => onChangePixelation(e.target.value)}
          className="w-full bg-surface text-text text-xs p-1.5 rounded border border-surface-lighter"
        >
          <option value="dominant">主色模式（卡通风）</option>
          <option value="average">平均色模式（写实风）</option>
        </select>
      </div>

      {/* Dithering */}
      <div>
        <h3 className="text-xs font-medium text-text-muted mb-2 uppercase tracking-wider">抖动算法</h3>
        <select
          value={ditherAlgorithm}
          onChange={(e) => onChangeDither(e.target.value)}
          className="w-full bg-surface text-text text-xs p-1.5 rounded border border-surface-lighter mb-2"
        >
          <option value="none">无抖动</option>
          <option value="floyd-steinberg">Floyd-Steinberg</option>
          <option value="bayer">Bayer 矩阵</option>
        </select>
        {ditherAlgorithm !== 'none' && (
          <div>
            <label className="text-[10px] text-text-dim">
              抖动强度：{(ditherStrength * 100).toFixed(0)}%
            </label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={ditherStrength}
              onChange={(e) => onChangeDitherStrength(Number(e.target.value))}
              className="w-full accent-accent"
            />
          </div>
        )}
      </div>

      {/* Grid Bold */}
      <div>
        <h3 className="text-xs font-medium text-text-muted mb-2 uppercase tracking-wider">加粗线间隔</h3>
        <select
          value={gridBoldEvery}
          onChange={(e) => onChangeGridBold(Number(e.target.value))}
          className="w-full bg-surface text-text text-xs p-1.5 rounded border border-surface-lighter"
        >
          <option value={5}>每 5 格</option>
          <option value={10}>每 10 格</option>
        </select>
      </div>
    </div>
  );
}

function TabBtn({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`flex-1 flex items-center justify-center gap-1 py-2 text-xs transition-colors ${
        active
          ? 'text-accent border-b-2 border-accent'
          : 'text-text-muted hover:text-text'
      }`}
      onClick={onClick}
    >
      {icon}
      {label}
    </button>
  );
}
