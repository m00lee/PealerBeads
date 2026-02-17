// ============================================================
// PealerBeads – Unsaved Changes Confirmation Dialog
// ============================================================

import { useStore } from '@/store/useStore';
import { Save, X, Trash2 } from 'lucide-react';

export function UnsavedDialog() {
  const {
    showUnsavedDialog,
    setShowUnsavedDialog,
    pendingAction,
    setPendingAction,
    saveProject,
    markClean,
  } = useStore();

  if (!showUnsavedDialog) return null;

  const handleSave = async () => {
    const saved = await saveProject();
    if (saved) {
      setShowUnsavedDialog(false);
      const action = pendingAction;
      setPendingAction(null);
      action?.();
    }
    // If save was cancelled, stay on dialog
  };

  const handleDiscard = () => {
    markClean(); // Clear dirty flag so the pending action won't re-trigger
    setShowUnsavedDialog(false);
    const action = pendingAction;
    setPendingAction(null);
    action?.();
  };

  const handleCancel = () => {
    setShowUnsavedDialog(false);
    setPendingAction(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={handleCancel}
    >
      <div
        className="bg-surface-light rounded-xl shadow-2xl w-[380px] border border-surface-lighter p-6 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-text">未保存的更改</h3>
          <button
            className="text-text-muted hover:text-text transition-colors"
            onClick={handleCancel}
          >
            <X size={18} />
          </button>
        </div>

        {/* Message */}
        <p className="text-sm text-text-muted leading-relaxed">
          当前项目有未保存的更改。是否要在继续之前保存？
        </p>

        {/* Actions */}
        <div className="flex items-center gap-2 justify-end mt-2">
          <button
            className="px-4 py-1.5 text-xs text-text-muted hover:bg-surface-lighter rounded-lg transition-colors"
            onClick={handleCancel}
          >
            取消
          </button>
          <button
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
            onClick={handleDiscard}
          >
            <Trash2 size={13} />
            不保存
          </button>
          <button
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs bg-accent/20 text-accent hover:bg-accent/30 rounded-lg transition-colors font-medium"
            onClick={handleSave}
          >
            <Save size={13} />
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
