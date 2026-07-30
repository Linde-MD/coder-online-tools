export function createDefaultCurveModel(index = 0, deps = {}) {
  const { nextId, buildDefaultCurveAlias, buildDefaultFunctionSource } = deps;
  return {
    id: typeof nextId === 'function' ? nextId('curve') : `curve-${Date.now()}-${index}`,
    text: `新曲线 ${index + 1}`,
    alias: buildDefaultCurveAlias(index),
    color: '#1f77b4',
    dataMode: 'points',
    points: '(0,0), (100,100)',
    formulaSource: buildDefaultFunctionSource(index),
  };
}

export function createDefaultGroupModel(index = 0, deps = {}) {
  const { nextId, chartConfig, createDefaultCurve } = deps;
  return {
    id: typeof nextId === 'function' ? nextId('group') : `group-${Date.now()}-${index}`,
    title: `曲线组 ${index + 1}`,
    xName: chartConfig.xVariableName || 'X',
    xUnit: chartConfig.xUnit || '',
    yName: chartConfig.yVariableName || 'Y',
    yUnit: chartConfig.yUnit || '',
    formulaXMin: chartConfig.formulaXMin ?? 0,
    formulaXMax: chartConfig.formulaXMax ?? 100,
    curves: [createDefaultCurve(0)],
  };
}

export function normalizeCurveGroups(curveGroups, deps = {}) {
  const {
    chartConfig,
    nextId,
    createDefaultGroup,
    createDefaultCurve,
    buildDefaultCurveAlias,
    buildDefaultFunctionSource,
  } = deps;

  if (!Array.isArray(curveGroups) || curveGroups.length === 0) {
    curveGroups.splice(0, curveGroups.length, createDefaultGroup(0));
  }

  curveGroups.forEach((group, groupIdx) => {
    group.id = group.id || nextId('group');
    group.title = group.title || `曲线组 ${groupIdx + 1}`;
    group.xName = group.xName || chartConfig.xVariableName || 'X';
    group.xUnit = group.xUnit || chartConfig.xUnit || '';
    group.yName = group.yName || chartConfig.yVariableName || 'Y';
    group.yUnit = group.yUnit || chartConfig.yUnit || '';
    group.formulaXMin = Number.isFinite(Number(group.formulaXMin)) ? Number(group.formulaXMin) : (chartConfig.formulaXMin ?? 0);
    group.formulaXMax = Number.isFinite(Number(group.formulaXMax)) ? Number(group.formulaXMax) : (chartConfig.formulaXMax ?? 100);

    if (!Array.isArray(group.curves) || group.curves.length === 0) {
      group.curves = [createDefaultCurve(0)];
    }

    group.curves.forEach((curve, curveIdx) => {
      curve.id = curve.id || nextId('curve');
      curve.text = curve.text || `曲线 ${curveIdx + 1}`;
      curve.alias = String(curve.alias || '').trim() || buildDefaultCurveAlias(curveIdx);
      curve.color = curve.color || '#1f77b4';
      curve.dataMode = curve.dataMode === 'formula' ? 'formula' : 'points';
      curve.points = curve.points || '';
      curve.formulaSource = curve.formulaSource || buildDefaultFunctionSource(curveIdx);
    });
  });
}

export function moveCurveBetweenGroups(curveGroups, fromGroupIdx, fromCurveIdx, targetGroupIdx, createDefaultCurve) {
  if (!curveGroups[fromGroupIdx] || !curveGroups[targetGroupIdx]) return false;
  if (!curveGroups[fromGroupIdx].curves[fromCurveIdx]) return false;
  if (fromGroupIdx === targetGroupIdx) return false;

  const [movedCurve] = curveGroups[fromGroupIdx].curves.splice(fromCurveIdx, 1);
  if (!movedCurve) return false;

  curveGroups[targetGroupIdx].curves.push(movedCurve);
  if (curveGroups[fromGroupIdx].curves.length === 0) {
    curveGroups[fromGroupIdx].curves.push(createDefaultCurve(0));
  }

  return true;
}

export function addCurveToGroup(curveGroups, groupIdx, createDefaultCurve) {
  if (!curveGroups[groupIdx]) return false;
  curveGroups[groupIdx].curves.push(createDefaultCurve(curveGroups[groupIdx].curves.length));
  return true;
}

export function removeCurveFromGroup(curveGroups, groupIdx, curveIdx, createDefaultCurve) {
  if (!curveGroups[groupIdx] || !curveGroups[groupIdx].curves[curveIdx]) return false;
  curveGroups[groupIdx].curves.splice(curveIdx, 1);
  if (curveGroups[groupIdx].curves.length === 0) {
    curveGroups[groupIdx].curves.push(createDefaultCurve(0));
  }
  return true;
}

export function addGroup(curveGroups, createDefaultGroup) {
  curveGroups.push(createDefaultGroup(curveGroups.length));
  return true;
}

export function removeGroup(curveGroups, groupIdx) {
  if (!Number.isFinite(groupIdx) || curveGroups.length <= 1 || !curveGroups[groupIdx]) return false;
  curveGroups.splice(groupIdx, 1);
  return true;
}
