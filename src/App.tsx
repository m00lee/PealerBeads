import { useStore } from '@/store/useStore';
import { Toolbar } from '@/components/Toolbar';
import { LeftSidebar } from '@/components/Sidebar/LeftSidebar';
import { RightSidebar } from '@/components/Sidebar/RightSidebar';
import { EditorCanvas } from '@/components/Canvas/EditorCanvas';
import { ImageImportModal } from '@/components/ImageImport/ImageImportModal';
import { StatusBar } from '@/components/StatusBar';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

export default function App() {
  useKeyboardShortcuts();
  const showImportModal = useStore((s) => s.showImportModal);

  return (
    <div className="flex flex-col w-full h-full bg-surface">
      {/* Top Toolbar */}
      <Toolbar />

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
    </div>
  );
}
