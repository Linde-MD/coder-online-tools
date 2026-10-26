import { readStoredValue, writeStoredValue } from '@/shared/utils/app-storage.js';

export const SCRIPT_STORAGE_KEY = 'coderOnlineTools.wenyanScripts.v1';

export async function readWenyanScripts() {
  const stored = await readStoredValue(SCRIPT_STORAGE_KEY);
  return stored && typeof stored === 'object' ? stored : null;
}

export async function saveWenyanScripts(payload) {
  await writeStoredValue(SCRIPT_STORAGE_KEY, payload);
}