import { renderChart } from '../features/chart/chart-renderer.js';
import { chartConfig } from '../shared/config/chart-config.js';
import { initForm } from '../features/chart/ui/form-manager.js';
import { initResize } from '../features/chart/ui/resize-manager.js';
import { initFeatureMenu } from '../features/navigation/feature-manager.js';
import { initJ1939Tool } from '../features/j1939/ui/j1939-manager.js';
import {
  buildDefaultCurveAlias,
  buildDefaultFunctionSource,
  createPointsFromFormula,
  parseSingleFormulaFunction,
  validateGroupCurveAliases,
  validateGroupFormulaDependencies,
} from '../shared/config/formula-storage.js';
import { parseCoordinatePoints } from '../shared/utils/common-utils.js';

const CHART_UI_STORAGE_KEY = 'coderOnlineTools.chartUiState.v1';

function readChartUiStateFromStorage() {
  try {
    const raw = localStorage.getItem(CHART_UI_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (_) {
    return null;
  }
}

function applyChartUiStateToConfig(state) {
  if (!state || typeof state !== 'object') return;

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

function saveChartUiState(curveGroups) {
  try {
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

    const payload = {
      chartInputs: {
        width: Number(widthInput?.value),
        height: Number(heightInput?.value),
        showMaxGuideLines: Boolean(showMaxInput?.checked),
        showGrid: Boolean(showGridInput?.checked),
        showPoints: Boolean(showPointsInput?.checked),
        chartBackgroundColor: bgInput?.value || chartConfig.chartBackgroundColor,
        axisColor: axisInput?.value || chartConfig.axisColor,
        tickColor: tickInput?.value || chartConfig.tickColor,
        gridColor: gridInput?.value || chartConfig.gridColor,
        guideLineColor: guideInput?.value || chartConfig.guideLineColor,
      },
      curveGroups: Array.isArray(curveGroups) ? curveGroups : [],
    };

    localStorage.setItem(CHART_UI_STORAGE_KEY, JSON.stringify(payload));
  } catch (_) {
    // Ignore localStorage errors to avoid affecting render flow.
  }
}

function normalizePoints(points = []) {
  return points
    .map(item => ({ x: Number(item.x), y: Number(item.y) }))
    .filter(item => Number.isFinite(item.x) && Number.isFinite(item.y))
    .sort((a, b) => a.x - b.x);
}

function samplePointSeriesAtX(points, x) {
  if (!Array.isArray(points) || points.length === 0) {
    throw new Error('插值点为空，无法参与公式计算。');
  }

  if (points.length === 1) {
    return points[0].y;
  }

  if (x <= points[0].x) {
    return points[0].y;
  }

  const last = points[points.length - 1];
  if (x >= last.x) {
    return last.y;
  }

  for (let i = 1; i < points.length; i++) {
    const left = points[i - 1];
    const right = points[i];
    if (x > right.x) continue;

    const dx = right.x - left.x;
    if (dx === 0) {
      return right.y;
    }

    const t = (x - left.x) / dx;
    return left.y + (right.y - left.y) * t;
  }

  return last.y;
}

function buildGroupCurves(group, sampleCount, groupIdx) {
  const xMin = Number(group.formulaXMin);
  const xMax = Number(group.formulaXMax);
  const safeXMin = Number.isFinite(xMin) ? xMin : 0;
  const safeXMax = Number.isFinite(xMax) ? xMax : 100;

  const pointSeriesList = group.curves.map(curve => {
    if (curve.dataMode !== 'points') return null;
    return normalizePoints(parseCoordinatePoints(curve.points || ''));
  });

  const formulaFnList = group.curves.map((curve, idx) => {
    if (curve.dataMode !== 'formula') return null;
    return parseSingleFormulaFunction(curve.formulaSource || buildDefaultFunctionSource(idx));
  });

  const aliasToIndex = validateGroupCurveAliases(group.curves);
  const { dependencies } = validateGroupFormulaDependencies(group.curves);

  function evaluateCurveAtX(curveIdx, x, stack = [], cache = new Map()) {
    const safeX = Number(x);
    if (!Number.isFinite(safeX)) {
      throw new Error(`曲线 ${curveIdx + 1} 收到无效 x 值: ${x}`);
    }

    const cacheKey = `${curveIdx}@${safeX}`;
    if (cache.has(cacheKey)) {
      return cache.get(cacheKey);
    }

    if (stack.includes(curveIdx)) {
      const cycleText = [...stack, curveIdx].map(i => `曲线${i + 1}`).join(' -> ');
      throw new Error(`检测到循环引用：${cycleText}`);
    }

    const curve = group.curves[curveIdx];
    if (!curve) {
      throw new Error(`曲线 ${curveIdx + 1} 不存在。`);
    }

    let y;
    if (curve.dataMode === 'points') {
      const points = pointSeriesList[curveIdx];
      y = samplePointSeriesAtX(points, safeX);
    } else {
      const formulaFn = formulaFnList[curveIdx];
      if (typeof formulaFn !== 'function') {
        throw new Error(`曲线 ${curveIdx + 1} 公式不可用。`);
      }

      const refs = dependencies[curveIdx] || [];
      const nextStack = [...stack, curveIdx];
      const scope = { Math };
      for (let i = 0; i < refs.length; i++) {
        const refIdx = refs[i];
        const yValue = evaluateCurveAtX(refIdx, safeX, nextStack, cache);
        scope[`x${refIdx + 1}`] = yValue;
        scope[`y${refIdx + 1}`] = yValue;
        scope[`f${refIdx + 1}`] = (nextX) => evaluateCurveAtX(refIdx, Number(nextX), nextStack, cache);
      }

      const aliasEntries = Object.entries(aliasToIndex);
      for (let i = 0; i < aliasEntries.length; i++) {
        const [alias, refIdx] = aliasEntries[i];
        scope[alias] = (nextX) => evaluateCurveAtX(Number(refIdx), Number(nextX), nextStack, cache);
      }

      y = Number(formulaFn(safeX, scope));
      if (!Number.isFinite(y)) {
        throw new Error(`曲线 ${curveIdx + 1} 在 x=${safeX} 时结果不是有效数字。`);
      }
    }

    cache.set(cacheKey, y);
    return y;
  }

  return group.curves.map((curve, idx) => {
    if (curve.dataMode !== 'formula') {
      return {
        text: curve.text,
        color: curve.color,
        points: pointSeriesList[idx] || [],
      };
    }

    let points = [];
    try {
      points = createPointsFromFormula((x) => {
        const cache = new Map();
        return evaluateCurveAtX(idx, Number(x), [], cache);
      }, safeXMin, safeXMax, sampleCount);
    } catch (error) {
      console.error(`组 ${groupIdx + 1} 曲线 ${idx + 1} 公式计算失败: ${error.message}`);
    }

    return {
      text: curve.text,
      color: curve.color,
      points,
    };
  });
}

function ensureCurve(curve, idx) {
  return {
    id: curve.id || `curve-${Date.now()}-${idx}`,
    color: curve.color || '#1f77b4',
    text: curve.text || `曲线 ${idx + 1}`,
    alias: String(curve.alias || '').trim() || buildDefaultCurveAlias(idx),
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

applyChartUiStateToConfig(readChartUiStateFromStorage());
let curveGroups = buildInitialGroups();
let bootstrapped = false;

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

  const groupData = curveGroups.map((group, groupIdx) => {
    let curves = [];
    try {
      curves = buildGroupCurves(group, sampleCount, groupIdx);
    } catch (error) {
      console.error(`组 ${groupIdx + 1} 配置无效: ${error.message}`);
      curves = (group.curves || []).map(curve => ({
        text: curve.text,
        color: curve.color,
        points: [],
      }));
    }

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
  
  saveChartUiState(curveGroups);
  renderChart(options);
}

export function bootstrapApp() {
  if (bootstrapped) return;
  bootstrapped = true;

  initForm(chartConfig, curveGroups, triggerRedraw);
  initResize(triggerRedraw);
  initFeatureMenu();
  initJ1939Tool();

  triggerRedraw();
}
