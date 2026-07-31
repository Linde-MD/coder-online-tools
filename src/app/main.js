import { chartConfig } from '@/shared/config/chart-config.js';
import { initForm } from '@/features/chart/ui/form-manager.js';
import { initResize } from '@/features/chart/ui/resize-manager.js';
import { initJ1939Tool } from '@/features/j1939/ui/j1939-manager.js';
import {
  applyChartUiStateToConfig,
  buildGroupCurves,
  buildGroupDataFromCurveGroups,
  buildInitialGroups,
  createChartRenderOptions,
  drawChart,
  readChartUiStateFromStorage,
  saveChartUiState,
} from '@/features/chart/services';

applyChartUiStateToConfig(chartConfig, readChartUiStateFromStorage());

let curveGroups = buildInitialGroups(chartConfig);
let chartInitialized = false;
let j1939Initialized = false;

function triggerRedraw() {
  const sampleCount = chartConfig.formulaSampleCount || 200;
  const groupData = buildGroupDataFromCurveGroups(curveGroups, sampleCount, buildGroupCurves);
  const options = createChartRenderOptions(groupData, (groupIdx, nextDisplaySettings) => {
    if (!Number.isFinite(Number(groupIdx))) return;
    const safeGroupIndex = Number(groupIdx);
    const group = curveGroups[safeGroupIndex];
    if (!group) return;

    group.displaySettings = {
      ...(group.displaySettings || {}),
      ...nextDisplaySettings,
    };

    triggerRedraw();
  });

  saveChartUiState(chartConfig, curveGroups);
  drawChart(options);
}

export function initializeChartModule() {
  if (chartInitialized) {
    triggerRedraw();
    return;
  }

  chartInitialized = true;
  initForm(chartConfig, curveGroups, triggerRedraw);
  initResize(curveGroups, triggerRedraw);
  triggerRedraw();
}

export function initializeJ1939Module() {
  if (j1939Initialized) return;
  j1939Initialized = true;
  initJ1939Tool();
}
