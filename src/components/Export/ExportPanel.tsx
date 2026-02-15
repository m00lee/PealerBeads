import { useState } from 'react';
import { useStore } from '@/store/useStore';
import { renderGridToCanvas, downloadCanvas, exportCSV, exportJSON, assignSymbols } from '@/lib/exportUtils';
import { exportPDF, type PdfExportOptions } from '@/lib/pdfExport';
import { X, Image, FileText, FileJson, Table } from 'lucide-react';
import type { ExportFormat } from '@/types';

export function ExportPanel() {
  const {
    pixels,
    gridDimensions: dims,
    colorSystem,
    getColorStats,
    setShowExportPanel,
    gridBoldEvery,
    projectName,
  } = useStore();

  const [format, setFormat] = useState<ExportFormat>('png');
  const [showGrid, setShowGrid] = useState(true);
  const [showSymbols, setShowSymbols] = useState(false);
  const [cellSize, setCellSize] = useState(20);
  const [beadMode, setBeadMode] = useState(false);

  // PDF-specific options
  const [pdfPaperSize, setPdfPaperSize] = useState<'a4' | 'a3' | 'letter'>('a4');
  const [pdfOrientation, setPdfOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [pdfShowLabels, setPdfShowLabels] = useState(true);
  const [pdfShowSymbols, setPdfShowSymbols] = useState(true);
  const [pdfShowLegend, setPdfShowLegend] = useState(true);
  const [pdfShowColors, setPdfShowColors] = useState(true);
  const [pdfCellSize, setPdfCellSize] = useState(0); // 0 = auto-fit
  const [pdfBoldEvery, setPdfBoldEvery] = useState<5 | 10>(5);

  const stats = getColorStats();

  const handleExport = () => {
    const symbolMap = assignSymbols(stats);
    const filename = projectName || 'pealer-beads';

    switch (format) {
      case 'png': {
        const canvas = renderGridToCanvas(pixels, dims, cellSize, {
          showGrid,
          showSymbols,
          symbolMap,
          boldEvery: gridBoldEvery,
          beadMode,
        });
        downloadCanvas(canvas, `${filename}.png`);
        break;
      }
      case 'csv':
        exportCSV(stats, colorSystem, `${filename}.csv`);
        break;
      case 'json':
        exportJSON(pixels, dims, stats, `${filename}.json`);
        break;
      case 'pdf': {
        const pdfOpts: Partial<PdfExportOptions> = {
          paperSize: pdfPaperSize,
          orientation: pdfOrientation,
          showGrid: true,
          showSymbols: pdfShowSymbols,
          showLabels: pdfShowLabels,
          showLegend: pdfShowLegend,
          showColorBlocks: pdfShowColors,
          gridBoldEvery: pdfBoldEvery,
          startIndex: 1,
          cellSizeMm: pdfCellSize,
          title: filename,
        };
        exportPDF(pixels, dims, stats, colorSystem, pdfOpts, `${filename}.pdf`);
        break;
      }
    }

    setShowExportPanel(false);
  };

  const formats: { key: ExportFormat; icon: React.ReactNode; label: string; desc: string }[] = [
    { key: 'png', icon: <Image size={16} />, label: 'PNG 图片', desc: '彩色底稿 / 符号底稿' },
    { key: 'pdf', icon: <FileText size={16} />, label: 'PDF 文档', desc: '分页打印，带图例' },
    { key: 'csv', icon: <Table size={16} />, label: 'CSV 表格', desc: '颜色统计 / 采购清单' },
    { key: 'json', icon: <FileJson size={16} />, label: 'JSON 数据', desc: '完整网格数据' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-surface-light rounded-lg shadow-2xl w-[420px] border border-surface-lighter">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-surface-lighter">
          <h2 className="text-sm font-medium text-text">导出</h2>
          <button
            className="text-text-muted hover:text-text p-1"
            onClick={() => setShowExportPanel(false)}
          >
            <X size={16} />
          </button>
        </div>

        {/* Format Selection */}
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {formats.map((f) => (
              <button
                key={f.key}
                className={`p-3 rounded-lg border text-left transition-all ${
                  format === f.key
                    ? 'border-accent bg-accent/10'
                    : 'border-surface-lighter hover:border-text-dim'
                }`}
                onClick={() => setFormat(f.key)}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={format === f.key ? 'text-accent' : 'text-text-muted'}>
                    {f.icon}
                  </span>
                  <span className="text-xs font-medium text-text">{f.label}</span>
                </div>
                <p className="text-[10px] text-text-dim">{f.desc}</p>
              </button>
            ))}
          </div>

          {/* PNG Options */}
          {format === 'png' && (
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">拼豆珠样式</span>
                <input
                  type="checkbox"
                  checked={beadMode}
                  onChange={(e) => setBeadMode(e.target.checked)}
                  className="accent-accent"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">显示网格线</span>
                <input
                  type="checkbox"
                  checked={showGrid}
                  onChange={(e) => setShowGrid(e.target.checked)}
                  className="accent-accent"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">显示符号编号</span>
                <input
                  type="checkbox"
                  checked={showSymbols}
                  onChange={(e) => setShowSymbols(e.target.checked)}
                  className="accent-accent"
                />
              </div>
              <div>
                <span className="text-xs text-text-muted">格子大小 (px): {cellSize}</span>
                <input
                  type="range"
                  min={10}
                  max={50}
                  value={cellSize}
                  onChange={(e) => setCellSize(Number(e.target.value))}
                  className="w-full accent-accent"
                />
              </div>
            </div>
          )}

          {/* PDF Options */}
          {format === 'pdf' && (
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">纸张大小</span>
                <select
                  value={pdfPaperSize}
                  onChange={(e) => setPdfPaperSize(e.target.value as 'a4' | 'a3' | 'letter')}
                  className="text-xs bg-surface rounded px-2 py-0.5 text-text border border-surface-lighter"
                >
                  <option value="a4">A4</option>
                  <option value="a3">A3</option>
                  <option value="letter">Letter</option>
                </select>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">方向</span>
                <select
                  value={pdfOrientation}
                  onChange={(e) => setPdfOrientation(e.target.value as 'portrait' | 'landscape')}
                  className="text-xs bg-surface rounded px-2 py-0.5 text-text border border-surface-lighter"
                >
                  <option value="portrait">纵向</option>
                  <option value="landscape">横向</option>
                </select>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">自适应页面</span>
                <input
                  type="checkbox"
                  checked={pdfCellSize === 0}
                  onChange={(e) => setPdfCellSize(e.target.checked ? 0 : 4)}
                  className="accent-accent"
                />
              </div>
              {pdfCellSize > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-muted">格子大小 (mm): {pdfCellSize}</span>
                  <input
                    type="range"
                    min={2}
                    max={10}
                    step={0.5}
                    value={pdfCellSize}
                    onChange={(e) => setPdfCellSize(Number(e.target.value))}
                    className="w-24 accent-accent"
                  />
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">加粗间隔</span>
                <select
                  value={pdfBoldEvery}
                  onChange={(e) => setPdfBoldEvery(Number(e.target.value) as 5 | 10)}
                  className="text-xs bg-surface rounded px-2 py-0.5 text-text border border-surface-lighter"
                >
                  <option value={5}>每 5 格</option>
                  <option value={10}>每 10 格</option>
                </select>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">行列标号 (A, B, C...)</span>
                <input
                  type="checkbox"
                  checked={pdfShowLabels}
                  onChange={(e) => setPdfShowLabels(e.target.checked)}
                  className="accent-accent"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">显示符号</span>
                <input
                  type="checkbox"
                  checked={pdfShowSymbols}
                  onChange={(e) => setPdfShowSymbols(e.target.checked)}
                  className="accent-accent"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">填充颜色</span>
                <input
                  type="checkbox"
                  checked={pdfShowColors}
                  onChange={(e) => setPdfShowColors(e.target.checked)}
                  className="accent-accent"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">颜色图例页</span>
                <input
                  type="checkbox"
                  checked={pdfShowLegend}
                  onChange={(e) => setPdfShowLegend(e.target.checked)}
                  className="accent-accent"
                />
              </div>
              {/* Page count estimate */}
              {(() => {
                const paper = pdfPaperSize === 'a4' ? { w: 210, h: 297 } : pdfPaperSize === 'a3' ? { w: 297, h: 420 } : { w: 215.9, h: 279.4 };
                const pw = pdfOrientation === 'landscape' ? paper.h : paper.w;
                const ph = pdfOrientation === 'landscape' ? paper.w : paper.h;
                const uw = pw - 20 - (pdfShowLabels ? 10 : 0);
                const uh = ph - 32 - (pdfShowLabels ? 8 : 0);
                let cs = pdfCellSize;
                if (cs <= 0) {
                  cs = Math.max(0.5, Math.min(uw / dims.N, uh / dims.M, 15));
                }
                const cols = Math.min(dims.N, Math.floor(uw / cs));
                const rows = Math.min(dims.M, Math.floor(uh / cs));
                const pages = Math.ceil(dims.N / cols) * Math.ceil(dims.M / rows) + (pdfShowLegend ? 1 : 0);
                return (
                  <div className="text-[10px] text-text-dim">
                    {pdfCellSize === 0 ? '自适应' : `${cs}mm`} | 预计 {pages} 页 (每页 {cols}×{rows} 格)
                  </div>
                );
              })()}
            </div>
          )}

          {/* Stats summary */}
          <div className="text-xs text-text-dim pt-2 border-t border-surface-lighter">
            网格 {dims.N}×{dims.M} | {stats.length} 种颜色 | {stats.reduce((s, c) => s + c.count, 0)} 颗豆
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-surface-lighter">
          <button
            className="px-4 py-1.5 text-sm text-text-muted hover:text-text rounded transition-colors"
            onClick={() => setShowExportPanel(false)}
          >
            取消
          </button>
          <button
            className="px-4 py-1.5 text-sm bg-accent text-surface rounded font-medium hover:bg-accent-hover transition-colors"
            onClick={handleExport}
          >
            导出
          </button>
        </div>
      </div>
    </div>
  );
}
