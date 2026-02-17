import { useState, lazy, Suspense } from 'react';
import { useStore } from '@/store/useStore';
import { Toolbar } from '@/components/Toolbar';
import { LeftSidebar } from '@/components/Sidebar/LeftSidebar';
import { RightSidebar } from '@/components/Sidebar/RightSidebar';
import { EditorCanvas } from '@/components/Canvas/EditorCanvas';
import { ImageImportModal } from '@/components/ImageImport/ImageImportModal';
import { StatusBar } from '@/components/StatusBar';
import { BoardExportPanel } from '@/components/Export/BoardExportPanel';
import { ColorOptimizePanel } from '@/components/Palette/ColorOptimizePanel';
import { UnsavedDialog } from '@/components/UnsavedDialog';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useAutoSave, useDirtyTracking } from '@/hooks/useAutoSave';
import { useWindowTitle } from '@/hooks/useWindowTitle';

// Lazy load 3D preview (Three.js is large)
const Preview3D = lazy(() =>
  import('@/components/Preview3D/Preview3D').then((m) => ({ default: m.Preview3D }))
);

export default function App() {
  useKeyboardShortcuts();
  useAutoSave();
  useDirtyTracking();
  useWindowTitle();

  const showImportModal = useStore((s) => s.showImportModal);
  const pixels = useStore((s) => s.pixels);
  const dims = useStore((s) => s.gridDimensions);

  const [show3D, setShow3D] = useState(false);
  const [showBoardExport, setShowBoardExport] = useState(false);
  const [showColorOptimize, setShowColorOptimize] = useState(false);

  return (
    <div className="flex flex-col w-full h-full bg-surface">
      {/* Top Toolbar */}
      <Toolbar
        onShow3D={() => setShow3D(true)}
        onShowBoardExport={() => setShowBoardExport(true)}
        onShowColorOptimize={() => setShowColorOptimize(true)}
      />

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Tools + Layers */}
        <LeftSidebar />

        {/* Center: Canvas */}
        <div className="flex-1 relative overflow-hidden bg-[#181825]">
          <EditorCanvas />
        </div>

        {/* Right: Palette + Stats + Export */}
        <RightSidebar />
      </div>

      {/* Status Bar */}
      <StatusBar />

      {/* Modals */}
      {showImportModal && <ImageImportModal />}
      {show3D && (
        <Suspense
          fallback={
            <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center">
              <p className="text-text-muted">加载 3D 引擎...</p>
            </div>
          }
        >
          <Preview3D pixels={pixels} dims={dims} onClose={() => setShow3D(false)} />
        </Suspense>
      )}
      {showBoardExport && <BoardExportPanel onClose={() => setShowBoardExport(false)} />}
      {showColorOptimize && <ColorOptimizePanel onClose={() => setShowColorOptimize(false)} />}

      {/* Unsaved Changes Dialog */}
      <UnsavedDialog />
    </div>
  );
}
