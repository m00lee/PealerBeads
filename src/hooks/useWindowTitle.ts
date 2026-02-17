// ============================================================
// PealerBeads – Window Title Sync Hook
// ============================================================
//
// Keeps the Tauri window title in sync with project name + dirty state.
// Falls back to document.title in browser mode.
// ============================================================

import { useEffect } from 'react';
import { useStore } from '@/store/useStore';

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export function useWindowTitle() {
  const projectName = useStore((s) => s.projectName);
  const isDirty = useStore((s) => s.isDirty);

  useEffect(() => {
    const title = `${projectName}${isDirty ? ' *' : ''} - PealerBeads`;

    if (isTauri()) {
      // Dynamically import to avoid issues in browser mode
      import('@tauri-apps/api/window').then(({ getCurrentWindow }) => {
        getCurrentWindow().setTitle(title).catch(() => {
          // Fallback if Tauri API fails
          document.title = title;
        });
      }).catch(() => {
        document.title = title;
      });
    } else {
      document.title = title;
    }
  }, [projectName, isDirty]);
}
