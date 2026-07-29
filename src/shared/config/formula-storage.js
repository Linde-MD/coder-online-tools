const FORMULA_STORAGE_KEY = 'chartFormulaFunctionSources';

export function buildDefaultFunctionSource(index = 0) {
  const defaultValue = index === 0 ? '0' : String(index * 10);
  return [
    '(x) => {',
    `  return ${defaultValue};`,
    '}'
  ].join('\n');
}

export function ensureFormulaSourceCount(sourceList, curveCount) {
  const safeCount = Math.max(1, curveCount);
  const next = Array.isArray(sourceList) ? sourceList.slice(0, safeCount) : [];

  for (let i = next.length; i < safeCount; i++) {
    next.push(buildDefaultFunctionSource(i));
  }

  return next;
}

export function loadFormulaSourceList(curveCount = 1, fallbackText = '') {
  const saved = localStorage.getItem(FORMULA_STORAGE_KEY);
  if (saved && saved.trim()) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return ensureFormulaSourceCount(
          parsed.map(item => String(item || '').trim()).filter(Boolean),
          curveCount,
        );
      }
    } catch (error) {
      // ignore corrupted storage and fall back to other sources
    }
  }

  if (fallbackText && fallbackText.trim()) {
    try {
      const legacyFns = parseFormulaFunctions(fallbackText);
      const legacySources = legacyFns.map(fn => fn.toString());
      return ensureFormulaSourceCount(legacySources, curveCount);
    } catch (error) {
      // fall back to defaults
    }
  }

  return ensureFormulaSourceCount([], curveCount);
}

export function saveFormulaSourceList(sourceList) {
  localStorage.setItem(FORMULA_STORAGE_KEY, JSON.stringify(sourceList));
}

export function parseSingleFormulaFunction(functionSource) {
  const code = String(functionSource || '').trim();
  if (!code) {
    throw new Error('公式内容为空，请输入箭头函数。');
  }

  if (!code.includes('=>')) {
    throw new Error('请使用箭头函数语法，例如 (x) => { return x; }。');
  }

  let fn;
  try {
    fn = Function(`"use strict"; return (${code});`)();
  } catch (error) {
    throw new Error(`公式语法错误: ${error.message}`);
  }

  if (typeof fn !== 'function') {
    throw new Error('公式必须是可调用函数。');
  }

  return fn;
}

export function validateFormulaFunctionRuntime(fn, sampleXs = [0]) {
  if (typeof fn !== 'function') {
    throw new Error('公式必须是函数。');
  }

  const samples = Array.isArray(sampleXs) && sampleXs.length > 0 ? sampleXs : [0];
  for (let i = 0; i < samples.length; i++) {
    const x = Number(samples[i]);
    if (!Number.isFinite(x)) continue;

    let y;
    try {
      y = fn(x);
    } catch (error) {
      throw new Error(`公式运行失败：x=${x} 时抛出异常 (${error.message})`);
    }

    const yNum = Number(y);
    if (!Number.isFinite(yNum)) {
      throw new Error(`公式运行失败：x=${x} 时返回值不是有效数字。`);
    }
  }
}

export function parseFormulaFunctions(formulaText) {
  const code = String(formulaText || '').trim();
  if (!code) {
    throw new Error('公式内容为空，请至少提供一个函数。');
  }

  let formulaList;
  try {
    formulaList = Function(`"use strict"; return (${code});`)();
  } catch (error) {
    throw new Error(`公式语法错误: ${error.message}`);
  }

  if (!Array.isArray(formulaList) || formulaList.length === 0) {
    throw new Error('公式内容必须是函数数组，例如 [(x) => { return x; }]。');
  }

  formulaList.forEach((fn, idx) => {
    if (typeof fn !== 'function') {
      throw new Error(`第 ${idx + 1} 个元素不是函数。`);
    }
  });

  return formulaList;
}

export function createPointsFromFormula(fn, xStart, xEnd, sampleCount = 200) {
  let minX = Number(xStart);
  let maxX = Number(xEnd);

  if (!Number.isFinite(minX) || !Number.isFinite(maxX)) {
    throw new Error('横坐标范围必须是有效数字。');
  }

  if (maxX < minX) {
    const temp = minX;
    minX = maxX;
    maxX = temp;
  }

  const safeSamples = Math.max(2, Math.floor(Number(sampleCount) || 200));
  const points = [];

  if (minX === maxX) {
    const y = Number(fn(minX));
    if (Number.isFinite(y)) {
      points.push({ x: minX, y });
    }
    return points;
  }

  for (let i = 0; i < safeSamples; i++) {
    const t = i / (safeSamples - 1);
    const x = minX + (maxX - minX) * t;
    const y = Number(fn(x));
    if (!Number.isFinite(y)) continue;
    points.push({ x, y });
  }

  return points;
}
