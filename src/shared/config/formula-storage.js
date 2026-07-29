const FORMULA_STORAGE_KEY = 'chartFormulaFunctionSources';
const JS_RESERVED_WORDS = new Set([
  'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default', 'delete',
  'do', 'else', 'enum', 'export', 'extends', 'false', 'finally', 'for', 'function', 'if',
  'import', 'in', 'instanceof', 'new', 'null', 'return', 'super', 'switch', 'this', 'throw',
  'true', 'try', 'typeof', 'var', 'void', 'while', 'with', 'yield', 'let', 'static',
  'implements', 'interface', 'package', 'private', 'protected', 'public', 'await',
]);

const SYSTEM_ALIAS_WORDS = new Set(['x', 'math']);

export function buildDefaultCurveAlias(index = 0) {
  return `curve${Math.max(1, index + 1)}`;
}

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isSystemPatternAlias(alias) {
  return /^(x|y|f)\d+$/i.test(alias);
}

export function validateGroupCurveAliases(curves = []) {
  if (!Array.isArray(curves)) {
    throw new Error('曲线组数据无效。');
  }

  const aliasToIndex = {};
  const seen = new Set();

  for (let i = 0; i < curves.length; i++) {
    const curve = curves[i] || {};
    const rawAlias = String(curve.alias || '').trim();
    const alias = rawAlias || buildDefaultCurveAlias(i);

    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(alias)) {
      throw new Error(`曲线 ${i + 1} 别名无效：${alias}。仅支持字母/数字/下划线，且不能以数字开头。`);
    }

    const lower = alias.toLowerCase();
    if (JS_RESERVED_WORDS.has(lower) || SYSTEM_ALIAS_WORDS.has(lower) || isSystemPatternAlias(alias)) {
      throw new Error(`曲线 ${i + 1} 别名不可用：${alias}。请避免 JS 关键字及 x/y/f + 数字等系统保留名称。`);
    }

    if (seen.has(lower)) {
      throw new Error(`曲线别名重复：${alias}。同组内别名必须唯一（不区分大小写）。`);
    }

    seen.add(lower);
    aliasToIndex[alias] = i;
  }

  return aliasToIndex;
}

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

  let invoke;
  try {
    invoke = Function('x', 'scope', [
      'const ctx = scope && typeof scope === "object" ? scope : {};',
      'with (ctx) {',
      `  return ((${code}))(x);`,
      '}'
    ].join('\n'));
  } catch (error) {
    throw new Error(`公式语法错误: ${error.message}`);
  }

  return function formulaEvaluator(x, scope = {}) {
    return invoke(x, scope);
  };
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

export function extractCurveReferences(functionSource, curveCount = 0, aliasToIndex = {}) {
  const code = String(functionSource || '');
  const maxCurveCount = Math.max(0, Number(curveCount) || 0);
  const refs = new Set();

  function collectIndexByNumber(regex, namePrefix) {
    let match;
    while ((match = regex.exec(code)) !== null) {
      const curveNumber = Number(match[1]);
      if (!Number.isInteger(curveNumber) || curveNumber <= 0) continue;

      if (maxCurveCount > 0 && curveNumber > maxCurveCount) {
        throw new Error(`公式引用了 ${namePrefix}${curveNumber}，但当前曲线组只有 ${maxCurveCount} 条曲线。`);
      }

      refs.add(curveNumber - 1);
    }
  }

  // Legacy compatibility: x1/x2...
  collectIndexByNumber(/\bx(\d+)\b/g, 'x');
  // Preferred value reference: y1/y2...
  collectIndexByNumber(/\by(\d+)\b/g, 'y');
  // Preferred function reference: f1(x), f2(x + 1)...
  collectIndexByNumber(/\bf(\d+)\s*\(/g, 'f');

  const aliasEntries = Object.entries(aliasToIndex || {});
  for (let i = 0; i < aliasEntries.length; i++) {
    const [alias, idx] = aliasEntries[i];
    const aliasCallRegex = new RegExp(`\\b${escapeRegExp(alias)}\\s*\\(`, 'g');
    if (aliasCallRegex.test(code)) {
      refs.add(Number(idx));
    }
  }

  return Array.from(refs).sort((a, b) => a - b);
}

export function validateGroupFormulaDependencies(curves = []) {
  if (!Array.isArray(curves)) {
    throw new Error('曲线组数据无效。');
  }

  const aliasToIndex = validateGroupCurveAliases(curves);

  const dependencies = curves.map((curve, idx) => {
    if (!curve || curve.dataMode !== 'formula') return [];
    const deps = extractCurveReferences(curve.formulaSource || '', curves.length, aliasToIndex);
    if (deps.includes(idx)) {
      throw new Error(`曲线 ${idx + 1} 的公式不能直接引用自身（如 y${idx + 1} / f${idx + 1}(x) / 自身别名）。`);
    }
    return deps;
  });

  const state = new Array(curves.length).fill(0);
  const stack = [];

  function visit(curveIdx) {
    if (!curves[curveIdx] || curves[curveIdx].dataMode !== 'formula') return;
    if (state[curveIdx] === 2) return;

    if (state[curveIdx] === 1) {
      const loopStart = stack.indexOf(curveIdx);
      const cycle = [...stack.slice(loopStart), curveIdx].map(i => `曲线${i + 1}`).join(' -> ');
      throw new Error(`检测到公式循环依赖：${cycle}`);
    }

    state[curveIdx] = 1;
    stack.push(curveIdx);

    const deps = dependencies[curveIdx] || [];
    for (let i = 0; i < deps.length; i++) {
      const depIdx = deps[i];
      if (!curves[depIdx] || curves[depIdx].dataMode !== 'formula') continue;
      visit(depIdx);
    }

    stack.pop();
    state[curveIdx] = 2;
  }

  for (let i = 0; i < curves.length; i++) {
    if (curves[i]?.dataMode === 'formula') {
      visit(i);
    }
  }

  return {
    dependencies,
    aliasToIndex,
  };
}
