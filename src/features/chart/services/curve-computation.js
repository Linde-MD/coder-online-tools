import {
  buildDefaultCurveAlias,
  buildDefaultFunctionSource,
  createPointsFromFormula,
  parseSingleFormulaFunction,
  validateGroupCurveAliases,
  validateGroupFormulaDependencies,
} from '@/shared/config/formula-storage.js';
import { normalizeGroupDisplaySettings } from '@/features/chart/services/curve-groups-model.js';
import { parseCoordinatePoints } from '@/shared/utils/common-utils.js';

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

  if (points.length === 1) return points[0].y;
  if (x <= points[0].x) return points[0].y;

  const last = points[points.length - 1];
  if (x >= last.x) return last.y;

  for (let i = 1; i < points.length; i++) {
    const left = points[i - 1];
    const right = points[i];
    if (x > right.x) continue;

    const dx = right.x - left.x;
    if (dx === 0) return right.y;

    const t = (x - left.x) / dx;
    return left.y + (right.y - left.y) * t;
  }

  return last.y;
}

function ensureCurve(curve, idx) {
  const rawJsSource = String(curve.formulaSource || '').trim();
  const rawDslSource = String(curve.formulaDslSource || '').trim();
  let formulaLanguage = 'dsl';
  if (curve.formulaLanguage === 'dsl' || curve.formulaLanguage === 'js') {
    formulaLanguage = curve.formulaLanguage;
  } else if (rawDslSource) {
    formulaLanguage = 'dsl';
  } else if (rawJsSource.includes('=>')) {
    formulaLanguage = 'js';
  }

  const defaultDslSource = idx === 0 ? '0' : String(idx * 10);
  return {
    id: curve.id || `curve-${Date.now()}-${idx}`,
    color: curve.color || '#1f77b4',
    text: curve.text || `曲线 ${idx + 1}`,
    alias: String(curve.alias || '').trim() || buildDefaultCurveAlias(idx),
    dataMode: curve.dataMode === 'formula' ? 'formula' : 'points',
    points: curve.points || '',
    formulaLanguage,
    formulaDslSource: rawDslSource || (formulaLanguage === 'dsl' ? defaultDslSource : ''),
    formulaSource: curve.formulaSource || buildDefaultFunctionSource(idx),
  };
}

export function buildInitialGroups(chartConfig) {
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
      displaySettings: normalizeGroupDisplaySettings(group.displaySettings || {}, chartConfig),
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
    displaySettings: normalizeGroupDisplaySettings({}, chartConfig),
    curves: legacyCurves.map((curve, idx) => ensureCurve(curve, idx)),
  }];
}

export function buildGroupCurves(group, sampleCount, groupIdx) {
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
