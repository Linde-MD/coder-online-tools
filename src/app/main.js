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

let curveGroups = buildInitialGroups(chartConfig);
let chartInitialized = false;
let chartInitialization = null;
let j1939Initialized = false;
let j1939Initialization = null;

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

export async function initializeChartModule() {
  if (chartInitialized) {
    triggerRedraw();
    return;
  }

  if (!chartInitialization) {
    chartInitialization = (async () => {
      applyChartUiStateToConfig(chartConfig, await readChartUiStateFromStorage());
      curveGroups = buildInitialGroups(chartConfig);
      initForm(chartConfig, curveGroups, triggerRedraw);
      initResize(curveGroups, triggerRedraw);
      chartInitialized = true;
      triggerRedraw();
    })();
  }
  await chartInitialization;
}

export async function initializeJ1939Module() {
  if (j1939Initialized) return;
  if (!j1939Initialization) j1939Initialization = initJ1939Tool();
  await j1939Initialization;
  j1939Initialized = true;
}
