import { AUTO_SAVE_INTERVAL_MS } from '@/features/can-arch/domain/can-arch-constants.js';

export function useAutoSave({ persistNodes }) {
  let autoSaveTimerId = null;

  function startAutoSaveTimer() {
    if (autoSaveTimerId) return;
    autoSaveTimerId = window.setInterval(() => {
      persistNodes();
    }, AUTO_SAVE_INTERVAL_MS);
  }

  function stopAutoSaveTimer() {
    if (!autoSaveTimerId) return;
    window.clearInterval(autoSaveTimerId);
    autoSaveTimerId = null;
  }

  return {
    startAutoSaveTimer,
    stopAutoSaveTimer,
  };
}