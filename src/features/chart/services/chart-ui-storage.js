import { normalizeGroupDisplaySettings } from '@/features/chart/services/curve-groups-model.js';

export const CHART_UI_STORAGE_KEY = 'coderOnlineTools.chartUiState.v1';

export function readChartUiStateFromStorage(storageKey = CHART_UI_STORAGE_KEY) {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (_) {
    return null;
  }
}

export function applyChartUiStateToConfig(chartConfig, state) {
  if (!chartConfig || !state || typeof state !== 'object') return;

  // Keep compatibility with legacy payloads that used a single shared chartInputs object.
  const inputs = state.chartInputs;
  if (inputs && typeof inputs === 'object') {
    const width = Number(inputs.width);
    const height = Number(inputs.height);
    if (Number.isFinite(width)) chartConfig.width = width;
    if (Number.isFinite(height)) chartConfig.height = height;
    if (typeof inputs.showGrid === 'boolean') chartConfig.showGrid = inputs.showGrid;
    if (typeof inputs.showPoints === 'boolean') chartConfig.showPoints = inputs.showPoints;

    if (typeof inputs.chartBackgroundColor === 'string' && inputs.chartBackgroundColor) chartConfig.chartBackgroundColor = inputs.chartBackgroundColor;
    if (typeof inputs.axisColor === 'string' && inputs.axisColor) chartConfig.axisColor = inputs.axisColor;
    if (typeof inputs.tickColor === 'string' && inputs.tickColor) chartConfig.tickColor = inputs.tickColor;
    if (typeof inputs.gridColor === 'string' && inputs.gridColor) chartConfig.gridColor = inputs.gridColor;
  }

  if (Array.isArray(state.curveGroups) && state.curveGroups.length > 0) {
    chartConfig.chartGroups = state.curveGroups.map((group) => ({
      ...group,
      displaySettings: normalizeGroupDisplaySettings(group?.displaySettings || {}, chartConfig),
    }));
  }
}

export function saveChartUiState(chartConfig, curveGroups, storageKey = CHART_UI_STORAGE_KEY) {
  try {
    const payload = {
      curveGroups: Array.isArray(curveGroups)
        ? curveGroups.map((group) => ({
            ...group,
            displaySettings: normalizeGroupDisplaySettings(group?.displaySettings || {}, chartConfig),
          }))
        : [],
    };

    localStorage.setItem(storageKey, JSON.stringify(payload));
  } catch (_) {
    // Ignore localStorage errors to avoid affecting render flow.
  }
}
