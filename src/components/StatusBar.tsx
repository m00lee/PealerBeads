import { useStore } from '@/store/useStore';

export function StatusBar() {
  const { gridDimensions: dims, activeTool, zoom, selectedColor, gridType } = useStore();
  const hoverInfo = ''; // Could be extended with hover cell coords

  return (
    <div className="h-6 bg-surface-light border-t border-surface-lighter flex items-center px-3 gap-4 text-[10px] text-text-dim shrink-0">
      <span>
        网格: {dims.N}×{dims.M} ({gridType === 'square' ? '方格' : '六角'})
      </span>
      <span>
        工具: {toolLabel(activeTool)}
      </span>
      <span>
        缩放: {Math.round(zoom * 100)}%
      </span>
      {selectedColor && (
        <span className="flex items-center gap-1">
          颜色:
          <span
            className="inline-block w-3 h-3 rounded-sm border border-surface-lighter"
            style={{ backgroundColor: selectedColor.hex }}
          />
          {selectedColor.key}
        </span>
      )}
      <div className="flex-1" />
      <span>PealerBeads v0.1.0</span>
    </div>
  );
}

function toolLabel(tool: string): string {
  const map: Record<string, string> = {
    pencil: '画笔',
    eraser: '橡皮擦',
    fill: '油漆桶',
    eyedropper: '取色器',
    select: '选择',
    move: '移动',
    line: '线条',
    rect: '矩形',
    circle: '圆形',
  };
  return map[tool] || tool;
}
