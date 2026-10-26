import { readStoredValue, writeStoredValue } from '@/shared/utils/app-storage.js';

export const J1939_UI_STORAGE_KEY = 'coderOnlineTools.j1939UiState.v1';

export function readJ1939UiState() {
  return readStoredValue(J1939_UI_STORAGE_KEY);
}

export function saveJ1939UiState(state) {
  return writeStoredValue(J1939_UI_STORAGE_KEY, state);
}