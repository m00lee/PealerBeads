import { useMemo, useState } from 'react';
import { useStore } from '@/store/useStore';
import { sortByHue } from '@/lib/colorSystem';
import type { PaletteColor } from '@/types';
import { Search, Lock, LockOpen } from 'lucide-react';

export function ColorPalette() {
  const {
    palette,
    selectedColor,
    setSelectedColor,
    lockedColors,
    toggleColorLock,
  } = useStore();

  const [search, setSearch] = useState('');
  const [sortMode, setSortMode] = useState<'default' | 'hue'>('hue');

  const displayed = useMemo(() => {
    let list = palette;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.key.toLowerCase().includes(q) ||
          c.hex.toLowerCase().includes(q)
      );
    }
    if (sortMode === 'hue') {
      list = sortByHue(list.map((c) => ({ ...c, hex: c.hex }))) as PaletteColor[];
    }
    return list;
  }, [palette, search, sortMode]);

  return (
    <div>
      {/* Search */}
      <div className="relative mb-2">
        <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-text-dim" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索色号..."
          className="w-full bg-surface text-text text-xs pl-6 pr-2 py-1.5 rounded border border-surface-lighter"
        />
      </div>

      {/* Sort toggle */}
      <div className="flex gap-1 mb-2">
        <button
          className={`text-[10px] px-2 py-0.5 rounded ${
            sortMode === 'default' ? 'bg-accent/20 text-accent' : 'text-text-dim hover:bg-surface'
          }`}
          onClick={() => setSortMode('default')}
        >
          默认
        </button>
        <button
          className={`text-[10px] px-2 py-0.5 rounded ${
            sortMode === 'hue' ? 'bg-accent/20 text-accent' : 'text-text-dim hover:bg-surface'
          }`}
          onClick={() => setSortMode('hue')}
        >
          色相
        </button>
      </div>

      {/* Colors Grid */}
      <div className="grid grid-cols-7 gap-1">
        {displayed.map((c) => {
          const isSelected = selectedColor?.hex === c.hex;
          const isLocked = lockedColors.has(c.hex);
          return (
            <div key={c.hex} className="relative group">
              <button
                className={`relative w-full aspect-square rounded-md border-2 transition-all duration-150 ${
                  isSelected
                    ? 'border-accent ring-2 ring-accent/50 scale-110 z-10'
                    : 'border-transparent hover:border-white/40 hover:scale-105'
                }`}
                style={{ backgroundColor: c.hex }}
                onClick={() => setSelectedColor(c)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  toggleColorLock(c.hex);
                }}
              >
                {isLocked && (
                  <Lock size={8} className="absolute top-0 right-0 text-white drop-shadow" />
                )}
              </button>
              {/* Hover tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-surface-light border border-surface-lighter rounded shadow-lg text-[10px] whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                <div className="font-medium text-text">{c.key}</div>
                <div className="text-text-dim font-mono">{c.hex}</div>
                {isLocked && <div className="text-amber-400">🔒 已锁定</div>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected color preview */}
      {selectedColor && (
        <div className="mt-3 flex items-center gap-2 p-2 bg-surface rounded">
          <div
            className="w-8 h-8 rounded border border-surface-lighter"
            style={{ backgroundColor: selectedColor.hex }}
          />
          <div>
            <div className="text-xs font-mono text-text">{selectedColor.key}</div>
            <div className="text-[10px] text-text-dim">{selectedColor.hex}</div>
          </div>
        </div>
      )}

      <p className="text-[10px] text-text-dim mt-2">
        右键点击颜色可锁定/解锁
      </p>
    </div>
  );
}
