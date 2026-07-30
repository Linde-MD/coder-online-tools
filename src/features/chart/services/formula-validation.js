export function validateFormulaDraft(options) {
  const {
    curveGroups,
    editingGroupIndex,
    editingCurveIndex,
    formulaText,
    formulaLanguage = 'js',
    formulaDslSource = '',
    parseSingleFormulaFunction,
    validateGroupCurveAliases,
    validateGroupFormulaDependencies,
    validateFormulaFunctionRuntime,
  } = options;

  if (editingGroupIndex < 0 || editingGroupIndex >= curveGroups.length) {
    throw new Error('当前编辑的曲线组索引无效。');
  }

  const group = curveGroups[editingGroupIndex];
  const xMin = group ? parseFloat(group.formulaXMin) : 0;
  const xMax = group ? parseFloat(group.formulaXMax) : 100;
  const mid = Number.isFinite(xMin) && Number.isFinite(xMax) ? (xMin + xMax) / 2 : 0;
  const sampleXs = [xMin, mid, xMax].filter(Number.isFinite);

  const groupCurves = group?.curves || [];
  if (editingCurveIndex < 0 || editingCurveIndex >= groupCurves.length) {
    throw new Error('当前编辑的曲线索引无效。');
  }

  const nextCurves = groupCurves.map(curve => ({ ...curve }));
  validateGroupCurveAliases(nextCurves);
  nextCurves[editingCurveIndex] = {
    ...nextCurves[editingCurveIndex],
    dataMode: 'formula',
    formulaLanguage: formulaLanguage === 'dsl' ? 'dsl' : 'js',
    formulaDslSource: formulaLanguage === 'dsl' ? String(formulaDslSource || '') : '',
    formulaSource: formulaText,
  };

  const aliasPlaceholders = validateGroupCurveAliases(nextCurves);
  const refScope = { Math };
  nextCurves.forEach((_, idx) => {
    refScope[`x${idx + 1}`] = 0;
    refScope[`y${idx + 1}`] = 0;
    refScope[`f${idx + 1}`] = () => 0;
  });
  Object.keys(aliasPlaceholders).forEach(alias => {
    refScope[alias] = () => 0;
  });

  const fn = parseSingleFormulaFunction(formulaText);
  validateFormulaFunctionRuntime((x) => fn(x, refScope), sampleXs);
  validateGroupFormulaDependencies(nextCurves);
}

export function buildFormulaEditorTitle(curveGroups, groupIdx, curveIdx) {
  const curve = curveGroups[groupIdx]?.curves?.[curveIdx];
  return `函数编辑器（组${groupIdx + 1} 曲线 ${curveIdx + 1}: ${curve ? curve.text : ''}）`;
}
