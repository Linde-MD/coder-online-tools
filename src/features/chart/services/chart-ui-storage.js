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

  const inputs = state.chartInputs;
  if (inputs && typeof inputs === 'object') {
    const width = Number(inputs.width);
    const height = Number(inputs.height);
    if (Number.isFinite(width)) chartConfig.width = width;
    if (Number.isFinite(height)) chartConfig.height = height;

    if (typeof inputs.showMaxGuideLines === 'boolean') chartConfig.showMaxGuideLines = inputs.showMaxGuideLines;
    if (typeof inputs.showGrid === 'boolean') chartConfig.showGrid = inputs.showGrid;
    if (typeof inputs.showPoints === 'boolean') chartConfig.showPoints = inputs.showPoints;

    if (typeof inputs.chartBackgroundColor === 'string' && inputs.chartBackgroundColor) chartConfig.chartBackgroundColor = inputs.chartBackgroundColor;
    if (typeof inputs.axisColor === 'string' && inputs.axisColor) chartConfig.axisColor = inputs.axisColor;
    if (typeof inputs.tickColor === 'string' && inputs.tickColor) chartConfig.tickColor = inputs.tickColor;
    if (typeof inputs.gridColor === 'string' && inputs.gridColor) chartConfig.gridColor = inputs.gridColor;
    if (typeof inputs.guideLineColor === 'string' && inputs.guideLineColor) chartConfig.guideLineColor = inputs.guideLineColor;
  }

  if (Array.isArray(state.curveGroups) && state.curveGroups.length > 0) {
    chartConfig.chartGroups = state.curveGroups;
  }
}

export function readChartInputsFromDom(chartConfig) {
  const widthInput = document.getElementById('input-width');
  const heightInput = document.getElementById('input-height');
  const showMaxInput = document.getElementById('input-showMaxGuideLines');
  const showGridInput = document.getElementById('input-showGrid');
  const showPointsInput = document.getElementById('input-showPoints');
  const bgInput = document.getElementById('input-bgcolor');
  const axisInput = document.getElementById('input-axis-color');
  const tickInput = document.getElementById('input-tick-color');
  const gridInput = document.getElementById('input-grid-color');
  const guideInput = document.getElementById('input-guide-color');

  return {
    width: parseInt(widthInput?.value, 10) || 800,
    height: parseInt(heightInput?.value, 10) || 800,
    showMaxGuideLines: Boolean(showMaxInput?.checked),
    showGrid: Boolean(showGridInput?.checked),
    showPoints: Boolean(showPointsInput?.checked),
    chartBackgroundColor: bgInput?.value || chartConfig.chartBackgroundColor || '#fffdf9',
    axisColor: axisInput?.value || chartConfig.axisColor || '#3d3d3a',
    tickColor: tickInput?.value || chartConfig.tickColor || '#6c6a64',
    gridColor: gridInput?.value || chartConfig.gridColor || '#d8d0c4',
    guideLineColor: guideInput?.value || chartConfig.guideLineColor || '#8e8b82',
  };
}

export function saveChartUiState(chartConfig, curveGroups, storageKey = CHART_UI_STORAGE_KEY) {
  try {
    const chartInputs = readChartInputsFromDom(chartConfig);
    const payload = {
      chartInputs,
      curveGroups: Array.isArray(curveGroups) ? curveGroups : [],
    };

    localStorage.setItem(storageKey, JSON.stringify(payload));
  } catch (_) {
    // Ignore localStorage errors to avoid affecting render flow.
  }
}
