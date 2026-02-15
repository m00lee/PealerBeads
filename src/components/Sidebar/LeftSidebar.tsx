import { useStore } from '@/store/useStore';
import type { ToolType, SymmetryMode } from '@/types';
import {
  Pencil,
  Eraser,
  PaintBucket,
  Pipette,
  MousePointer2,
  Move,
  Minus,
  Square,
  Circle,
  FlipHorizontal,
  FlipVertical,
} from 'lucide-react';

const tools: { type: ToolType; icon: React.ReactNode; label: string; shortcut: string }[] = [
  { type: 'pencil', icon: <Pencil size={18} />, label: '画笔', shortcut: 'B' },
  { type: 'eraser', icon: <Eraser size={18} />, label: '橡皮擦', shortcut: 'E' },
  { type: 'fill', icon: <PaintBucket size={18} />, label: '油漆桶', shortcut: 'G' },
  { type: 'eyedropper', icon: <Pipette size={18} />, label: '取色器', shortcut: 'I' },
  { type: 'select', icon: <MousePointer2 size={18} />, label: '选择', shortcut: 'V' },
  { type: 'move', icon: <Move size={18} />, label: '移动', shortcut: 'H' },
  { type: 'line', icon: <Minus size={18} />, label: '线条', shortcut: 'L' },
  { type: 'rect', icon: <Square size={18} />, label: '矩形', shortcut: 'R' },
  { type: 'circle', icon: <Circle size={18} />, label: '圆形', shortcut: 'C' },
];

export function LeftSidebar() {
  const { activeTool, setActiveTool, brushSize, setBrushSize, symmetry, setSymmetry } = useStore();

  return (
    <div className="w-12 bg-surface-light border-r border-surface-lighter flex flex-col items-center py-2 gap-0.5 shrink-0">
      {/* Tools */}
      {tools.map((t) => (
        <button
          key={t.type}
          className={`w-9 h-9 flex items-center justify-center rounded transition-colors ${
            activeTool === t.type
              ? 'bg-accent/20 text-accent'
              : 'text-text-muted hover:bg-surface-lighter hover:text-text'
          }`}
          onClick={() => setActiveTool(t.type)}
          title={`${t.label} (${t.shortcut})`}
        >
          {t.icon}
        </button>
      ))}

      <div className="w-6 h-px bg-surface-lighter my-2" />

      {/* Brush Size */}
      <div className="flex flex-col items-center gap-1">
        <span className="text-[10px] text-text-dim">笔刷</span>
        <span className="text-xs text-text-muted font-mono">{brushSize}</span>
        <input
          type="range"
          min={1}
          max={5}
          value={brushSize}
          onChange={(e) => setBrushSize(Number(e.target.value))}
          className="w-8 accent-accent"
          style={{ writingMode: 'vertical-lr', direction: 'rtl', height: 50 }}
          title="笔刷大小"
        />
      </div>

      <div className="w-6 h-px bg-surface-lighter my-2" />

      {/* Symmetry */}
      <button
        className={`w-9 h-9 flex items-center justify-center rounded transition-colors ${
          symmetry === 'horizontal' || symmetry === 'both'
            ? 'bg-accent/20 text-accent'
            : 'text-text-muted hover:bg-surface-lighter hover:text-text'
        }`}
        onClick={() => {
          const modes: SymmetryMode[] = ['none', 'horizontal', 'vertical', 'both'];
          const idx = modes.indexOf(symmetry);
          setSymmetry(modes[(idx + 1) % modes.length]);
        }}
        title={`对称模式：${
          symmetry === 'none'
            ? '关闭'
            : symmetry === 'horizontal'
            ? '水平'
            : symmetry === 'vertical'
            ? '垂直'
            : '双向'
        }`}
      >
        <FlipHorizontal size={18} />
      </button>
    </div>
  );
}
