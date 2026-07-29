import { renderChart } from '../features/chart/chart-renderer.js';
import { chartConfig } from '../shared/config/chart-config.js';
import { initForm } from '../features/chart/ui/form-manager.js';
import { initResize } from '../features/chart/ui/resize-manager.js';
import { initFeatureMenu } from '../features/navigation/feature-manager.js';
import { initJ1939Tool } from '../features/j1939/ui/j1939-manager.js';
import { buildDefaultFunctionSource, createPointsFromFormula, parseSingleFormulaFunction } from '../shared/config/formula-storage.js';

function ensureCurve(curve, idx) {
  return {
    id: curve.id || `curve-${Date.now()}-${idx}`,
    color: curve.color || '#1f77b4',
    text: curve.text || `曲线 ${idx + 1}`,
    dataMode: curve.dataMode === 'formula' ? 'formula' : 'points',
    points: curve.points || '',
    formulaSource: curve.formulaSource || buildDefaultFunctionSource(idx),
  };
}

function buildInitialGroups() {
  if (Array.isArray(chartConfig.chartGroups) && chartConfig.chartGroups.length > 0) {
    return chartConfig.chartGroups.map((group, groupIdx) => ({
      id: group.id || `group-${Date.now()}-${groupIdx}`,
      title: group.title || `曲线组 ${groupIdx + 1}`,
      xName: group.xName || chartConfig.xVariableName || 'X',
      xUnit: group.xUnit || chartConfig.xUnit || '',
      yName: group.yName || chartConfig.yVariableName || 'Y',
      yUnit: group.yUnit || chartConfig.yUnit || '',
      formulaXMin: Number.isFinite(Number(group.formulaXMin)) ? Number(group.formulaXMin) : (chartConfig.formulaXMin ?? 0),
      formulaXMax: Number.isFinite(Number(group.formulaXMax)) ? Number(group.formulaXMax) : (chartConfig.formulaXMax ?? 100),
      curves: Array.isArray(group.curves) && group.curves.length > 0
        ? group.curves.map((curve, curveIdx) => ensureCurve(curve, curveIdx))
        : [ensureCurve({}, 0)],
    }));
  }

  const legacyCurves = chartConfig.curveConfigs.map((cfg, idx) => ({
    color: cfg.color,
    text: cfg.text,
    dataMode: cfg.dataMode || 'points',
    points: chartConfig.coordinatePointsStr[idx] || '',
    formulaSource: chartConfig.formulaFunctionSources[idx] || buildDefaultFunctionSource(idx),
  }));

  return [{
    id: `group-${Date.now()}-0`,
    title: chartConfig.chartTitle || '示例曲线组 1',
    xName: chartConfig.xVariableName || 'X',
    xUnit: chartConfig.xUnit || '',
    yName: chartConfig.yVariableName || 'Y',
    yUnit: chartConfig.yUnit || '',
    formulaXMin: chartConfig.formulaXMin ?? 0,
    formulaXMax: chartConfig.formulaXMax ?? 100,
    curves: legacyCurves.map((curve, idx) => ensureCurve(curve, idx)),
  }];
}

let curveGroups = buildInitialGroups();

function triggerRedraw() {
  const widthInput = document.getElementById('input-width');
  const heightInput = document.getElementById('input-height');
  const w = parseInt(widthInput.value) || 800;
  const h = parseInt(heightInput.value) || 800;
  const showMax = document.getElementById('input-showMaxGuideLines').checked;
  const showGrid = document.getElementById('input-showGrid').checked;
  const showPoints = document.getElementById('input-showPoints').checked;
  const chartBackgroundColor = document.getElementById('input-bgcolor').value || '#fffdf9';
  const axisColor = document.getElementById('input-axis-color').value || '#3d3d3a';
  const tickColor = document.getElementById('input-tick-color').value || '#6c6a64';
  const gridColor = document.getElementById('input-grid-color').value || '#d8d0c4';
  const guideLineColor = document.getElementById('input-guide-color').value || '#8e8b82';
  const sampleCount = chartConfig.formulaSampleCount || 200;

  const groupData = curveGroups.map(group => {
    const xMin = Number(group.formulaXMin);
    const xMax = Number(group.formulaXMax);
    const curves = group.curves.map((curve, idx) => {
      if (curve.dataMode === 'formula') {
        let points = [];
        try {
          const formulaFn = parseSingleFormulaFunction(curve.formulaSource || buildDefaultFunctionSource(idx));
          points = createPointsFromFormula(formulaFn, xMin, xMax, sampleCount);
        } catch (error) {
          console.error(error.message);
        }
        return {
          text: curve.text,
          color: curve.color,
          points,
        };
      }

      return {
        text: curve.text,
        color: curve.color,
        pointsStr: curve.points,
      };
    });

    return {
      title: group.title,
      xName: group.xName,
      xUnit: group.xUnit,
      yName: group.yName,
      yUnit: group.yUnit,
      curves,
    };
  });
  
  const options = {
    width: w,
    height: h,
    showMaxGuideLines: showMax,
    showGridLines: showGrid,
    showPoints,
    chartBackgroundColor,
    axisColor,
    tickColor,
    gridColor,
    guideLineColor,
    groupData,
  };
  
  document.querySelectorAll('.svg-resize-wrapper').forEach(wrapper => {
    wrapper.style.width = w + 'px';
    wrapper.style.height = h + 'px';
    wrapper.style.setProperty('--chart-axis-color', axisColor);
    wrapper.style.setProperty('--chart-label-bg', 'rgba(255,255,255,0.72)');
  });
  
  renderChart(options);
}

initForm(chartConfig, curveGroups, triggerRedraw);
initResize(triggerRedraw);
initFeatureMenu();
initJ1939Tool();

triggerRedraw();
