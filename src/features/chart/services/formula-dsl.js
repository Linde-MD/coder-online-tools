const DSL_FUNCTION_MAP = {
  abs: 'Math.abs',
  min: 'Math.min',
  max: 'Math.max',
  pow: 'Math.pow',
  sqrt: 'Math.sqrt',
  exp: 'Math.exp',
  log: 'Math.log',
  log10: 'Math.log10',
  floor: 'Math.floor',
  ceil: 'Math.ceil',
  round: 'Math.round',
  sin: 'Math.sin',
  cos: 'Math.cos',
  tan: 'Math.tan',
  asin: 'Math.asin',
  acos: 'Math.acos',
  atan: 'Math.atan',
  atan2: 'Math.atan2',
};

const DSL_RESERVED_PATTERN = /(=>|\bfunction\b|\bnew\b|\bclass\b|\bwhile\b|\bfor\b|\bif\b|\btry\b|\bcatch\b|\{|\}|;)/i;
const INVALID_ASSIGNMENT_PATTERN = /(^|[^=!<>])=($|[^=])/;
const ALLOWED_CHAR_PATTERN = /^[A-Za-z0-9_\s+\-*/%().,?:<>=!&|]+$/;
const PIECEWISE_CONDITION_HINT = /(^|\n)\s*(else|[<>]=?\s*-?\d+(?:\.\d+)?|-?\d+(?:\.\d+)?\s*-\s*-?\d+(?:\.\d+)?|x\s*[<>]=?\s*-?\d+(?:\.\d+)?|[\[(]\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*[\])])\s*:/i;

function replaceFunctionCalls(expression) {
  let next = expression;
  Object.entries(DSL_FUNCTION_MAP).forEach(([name, target]) => {
    const regex = new RegExp(`\\b${name}\\s*\\(`, 'gi');
    next = next.replace(regex, `${target}(`);
  });

  next = next.replace(/\bPI\b/g, 'Math.PI');
  next = next.replace(/\bE\b/g, 'Math.E');
  return next;
}

function assertDslExpression(expression) {
  if (!expression) {
    throw new Error('DSL 公式不能为空。');
  }

  if (!ALLOWED_CHAR_PATTERN.test(expression)) {
    throw new Error('DSL 公式包含非法字符，请仅使用变量、数字、运算符和函数调用。');
  }

  if (DSL_RESERVED_PATTERN.test(expression)) {
    throw new Error('DSL 只支持表达式，不支持 function/if/for/new/分号/代码块。');
  }

  if (expression.includes('^')) {
    throw new Error('DSL 不支持 ^ 幂运算，请使用 pow(a, b)。');
  }

  if (INVALID_ASSIGNMENT_PATTERN.test(expression)) {
    throw new Error('DSL 表达式不允许赋值，请使用比较运算（==, ===）或直接表达式。');
  }
}

function assertCompilableJsExpression(jsExpression) {
  try {
    // Smoke-check expression syntax without executing business logic.
    Function('x', 'y1', 'f1', 'aliasFn', `return (${jsExpression});`);
  } catch (error) {
    throw new Error(`DSL 编译失败：${error.message}`);
  }
}

function isPiecewiseDslSource(source) {
  return PIECEWISE_CONDITION_HINT.test(source);
}

function normalizeInterval(min, max, minInclusive, maxInclusive) {
  const left = Number(min);
  const right = Number(max);
  if (!Number.isFinite(left) || !Number.isFinite(right)) {
    throw new Error('分段区间边界必须是有效数字。');
  }
  if (left > right) {
    throw new Error(`分段区间无效：左边界 ${left} 大于右边界 ${right}。`);
  }
  if (left === right && !(minInclusive && maxInclusive)) {
    throw new Error(`分段区间无效：${left} 到 ${right} 是空区间。`);
  }

  return {
    min: left,
    max: right,
    minInclusive: Boolean(minInclusive),
    maxInclusive: Boolean(maxInclusive),
  };
}

function parseDetectableInterval(conditionText) {
  const condition = String(conditionText || '').trim();
  if (!condition) return null;

  const rangeMatch = condition.match(/^(-?\d+(?:\.\d+)?)\s*-\s*(-?\d+(?:\.\d+)?)$/);
  if (rangeMatch) {
    return normalizeInterval(rangeMatch[1], rangeMatch[2], true, true);
  }

  const bracketRangeMatch = condition.match(/^([\[(])\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*([\])])$/);
  if (bracketRangeMatch) {
    return normalizeInterval(
      bracketRangeMatch[2],
      bracketRangeMatch[3],
      bracketRangeMatch[1] === '[',
      bracketRangeMatch[4] === ']'
    );
  }

  const compareMatch = condition.match(/^(<=|>=|<|>)\s*(-?\d+(?:\.\d+)?)$/);
  if (compareMatch) {
    const value = Number(compareMatch[2]);
    if (!Number.isFinite(value)) return null;

    if (compareMatch[1] === '>') {
      return { min: value, max: Infinity, minInclusive: false, maxInclusive: true };
    }
    if (compareMatch[1] === '>=') {
      return { min: value, max: Infinity, minInclusive: true, maxInclusive: true };
    }
    if (compareMatch[1] === '<') {
      return { min: -Infinity, max: value, minInclusive: true, maxInclusive: false };
    }
    return { min: -Infinity, max: value, minInclusive: true, maxInclusive: true };
  }

  const xCompareMatch = condition.match(/^x\s*(<=|>=|<|>)\s*(-?\d+(?:\.\d+)?)$/i);
  if (xCompareMatch) {
    return parseDetectableInterval(`${xCompareMatch[1]} ${xCompareMatch[2]}`);
  }

  return null;
}

function intervalToJsCondition(interval) {
  if (!interval || typeof interval !== 'object') {
    throw new Error('区间条件无效。');
  }

  const checks = [];
  if (Number.isFinite(interval.min)) {
    checks.push(`x ${interval.minInclusive ? '>=' : '>'} ${interval.min}`);
  }
  if (Number.isFinite(interval.max)) {
    checks.push(`x ${interval.maxInclusive ? '<=' : '<'} ${interval.max}`);
  }

  if (checks.length === 0) {
    return '(true)';
  }
  if (checks.length === 1) {
    return `(${checks[0]})`;
  }
  return `(${checks[0]} && ${checks[1]})`;
}

function intervalsOverlap(left, right) {
  const maxOfMins = left.min > right.min ? left.min : right.min;
  const minOfMaxs = left.max < right.max ? left.max : right.max;

  if (maxOfMins < minOfMaxs) {
    return true;
  }
  if (maxOfMins > minOfMaxs) {
    return false;
  }

  const leftTouches = left.max === maxOfMins
    ? left.maxInclusive
    : left.minInclusive;
  const rightTouches = right.max === maxOfMins
    ? right.maxInclusive
    : right.minInclusive;
  return leftTouches && rightTouches;
}

function formatIntervalForMessage(interval) {
  const left = interval.minInclusive ? '[' : '(';
  const right = interval.maxInclusive ? ']' : ')';
  const min = Number.isFinite(interval.min) ? interval.min : '-∞';
  const max = Number.isFinite(interval.max) ? interval.max : '+∞';
  return `${left}${min}, ${max}${right}`;
}

function validatePiecewiseIntervals(intervalClauses) {
  for (let i = 0; i < intervalClauses.length; i++) {
    for (let j = i + 1; j < intervalClauses.length; j++) {
      const left = intervalClauses[i];
      const right = intervalClauses[j];
      if (!intervalsOverlap(left.interval, right.interval)) continue;

      throw new Error(
        `分段区间重叠：第 ${left.lineNo} 行 ${formatIntervalForMessage(left.interval)} 与第 ${right.lineNo} 行 ${formatIntervalForMessage(right.interval)}。`
      );
    }
  }
}

function intervalStartsBeforeOrTouch(startInterval, nextInterval) {
  if (nextInterval.min > startInterval.max) {
    return false;
  }
  if (nextInterval.min < startInterval.max) {
    return true;
  }
  return startInterval.maxInclusive || nextInterval.minInclusive;
}

function findFirstCoverageGap(intervalClauses) {
  if (!Array.isArray(intervalClauses) || intervalClauses.length === 0) {
    return { type: 'all-uncovered' };
  }

  const sorted = intervalClauses
    .map(item => ({ ...item }))
    .sort((a, b) => {
      if (a.interval.min !== b.interval.min) return a.interval.min - b.interval.min;
      if (a.interval.minInclusive === b.interval.minInclusive) return 0;
      return a.interval.minInclusive ? -1 : 1;
    });

  const first = sorted[0].interval;
  if (Number.isFinite(first.min)) {
    return {
      type: 'left-gap',
      to: first.min,
      toInclusive: !first.minInclusive,
    };
  }

  let merged = { ...first };
  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i].interval;
    if (!intervalStartsBeforeOrTouch(merged, next)) {
      return {
        type: 'middle-gap',
        from: merged.max,
        fromInclusive: !merged.maxInclusive,
        to: next.min,
        toInclusive: !next.minInclusive,
      };
    }

    if (next.max > merged.max) {
      merged.max = next.max;
      merged.maxInclusive = next.maxInclusive;
    } else if (next.max === merged.max) {
      merged.maxInclusive = merged.maxInclusive || next.maxInclusive;
    }
  }

  if (Number.isFinite(merged.max)) {
    return {
      type: 'right-gap',
      from: merged.max,
      fromInclusive: !merged.maxInclusive,
    };
  }

  return null;
}

function formatGapMessage(gap) {
  if (!gap) return '';
  if (gap.type === 'all-uncovered') {
    return '分段区间未覆盖任何可判定范围。';
  }

  if (gap.type === 'left-gap') {
    const rightBracket = gap.toInclusive ? ']' : ')';
    return `检测到区间空洞：(-∞, ${gap.to}${rightBracket} 未覆盖。请补充分支或添加 else。`;
  }

  if (gap.type === 'middle-gap') {
    const leftBracket = gap.fromInclusive ? '[' : '(';
    const rightBracket = gap.toInclusive ? ']' : ')';
    return `检测到区间空洞：${leftBracket}${gap.from}, ${gap.to}${rightBracket} 未覆盖。请补充分支或添加 else。`;
  }

  const leftBracket = gap.fromInclusive ? '[' : '(';
  return `检测到区间空洞：${leftBracket}${gap.from}, +∞) 未覆盖。请补充分支或添加 else。`;
}

function toJsCondition(conditionText) {
  const condition = String(conditionText || '').trim();
  if (!condition) {
    throw new Error('分段条件不能为空。');
  }

  const interval = parseDetectableInterval(condition);
  if (interval) {
    return {
      jsCondition: intervalToJsCondition(interval),
      interval,
    };
  }

  assertDslExpression(condition);
  return {
    jsCondition: `(${replaceFunctionCalls(condition)})`,
    interval: null,
  };
}

function compilePiecewiseDslToJs(source) {
  const lines = String(source || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    throw new Error('DSL 公式不能为空。');
  }

  const clauses = [];
  const intervalClauses = [];
  let fallbackExpression = null;
  let elseLineNo = -1;

  lines.forEach((line, index) => {
    const splitAt = line.indexOf(':');
    if (splitAt <= 0) {
      throw new Error(`第 ${index + 1} 行缺少 ":"，分段 DSL 语法为 "条件: 表达式"。`);
    }

    const left = line.slice(0, splitAt).trim();
    const right = line.slice(splitAt + 1).trim();
    if (!right) {
      throw new Error(`第 ${index + 1} 行表达式为空。`);
    }

    assertDslExpression(right);
    const expr = `(${replaceFunctionCalls(right)})`;

    if (/^else$/i.test(left)) {
      if (elseLineNo > 0) {
        throw new Error(`第 ${index + 1} 行重复定义 else 分支。`);
      }
      fallbackExpression = expr;
      elseLineNo = index + 1;
      return;
    }

    if (elseLineNo > 0) {
      throw new Error(`第 ${index + 1} 行位于 else 之后，无法生效。`);
    }

    const parsedCondition = toJsCondition(left);
    clauses.push({ condition: parsedCondition.jsCondition, expression: expr });

    if (parsedCondition.interval) {
      intervalClauses.push({
        lineNo: index + 1,
        interval: parsedCondition.interval,
      });
    }
  });

  if (clauses.length === 0) {
    throw new Error('分段 DSL 至少需要一条条件分支。');
  }

  validatePiecewiseIntervals(intervalClauses);

  if (!fallbackExpression && intervalClauses.length === clauses.length) {
    const gap = findFirstCoverageGap(intervalClauses);
    if (gap) {
      throw new Error(formatGapMessage(gap));
    }
  }

  const fallback = fallbackExpression || 'NaN';
  const jsExpression = clauses.reduceRight((acc, item) => {
    return `(${item.condition} ? ${item.expression} : ${acc})`;
  }, fallback);

  assertCompilableJsExpression(jsExpression);
  return jsExpression;
}

export function compileDslFormulaToJs(dslSource) {
  const expression = String(dslSource || '').trim();
  const compiledExpression = isPiecewiseDslSource(expression)
    ? compilePiecewiseDslToJs(expression)
    : (() => {
      assertDslExpression(expression);
      return replaceFunctionCalls(expression);
    })();
  assertCompilableJsExpression(compiledExpression);

  return {
    dslSource: expression,
    jsExpression: compiledExpression,
    jsSource: [
      '(x) => {',
      `  return ${compiledExpression};`,
      '}',
    ].join('\n'),
  };
}

export function getDslFormulaHelpText() {
  return [
    'DSL 语法帮助',
    '',
    '1) DSL 仅支持“表达式”，无需写箭头函数。',
    '   示例: abs(y1 - y2) + sin(x)',
    '   也支持分段语法（每行一个分支）：',
    '   [0,10): y1',
    '   [10,30]: max(y1, y2)',
    '   >30: f2(x)',
    '   else: y3',
    '',
    '2) 可用变量：',
    '   x            当前横坐标',
    '   y1..yN       同组曲线在当前 x 的值',
    '   f1(x)..fN(x) 同组曲线函数调用',
    '   alias(x)     按曲线别名调用，例如 tempA(x)',
    '',
    '3) 可用函数：',
    '   abs/min/max/pow/sqrt/exp/log/log10/floor/ceil/round',
    '   sin/cos/tan/asin/acos/atan/atan2',
    '   常量 PI, E',
    '',
    '4) 注意：',
    '   - 不支持 if/for/function/new/分号/代码块',
    '   - 不支持 ^，请改用 pow(a,b)',
    '   - 分段语法使用 "条件: 表达式"，条件可写 [0,10)、(10,30]、0-10、>30、x<=20 或 else',
    '   - 可判定区间会自动做重叠检测，避免分支歧义',
    '   - 无 else 时会做区间覆盖检测，存在空洞会提示修复',
  ].join('\n');
}

export function getDslAssistSnippets() {
  return [
    { label: 'x', code: 'x' },
    { label: 'y1', code: 'y1' },
    { label: 'f1(x)', code: 'f1(x)' },
    { label: 'abs()', code: 'abs()' },
    { label: 'min(a,b)', code: 'min(a, b)' },
    { label: 'max(a,b)', code: 'max(a, b)' },
    { label: 'pow(a,b)', code: 'pow(a, b)' },
    { label: 'sin(x)', code: 'sin(x)' },
    { label: 'cos(x)', code: 'cos(x)' },
    { label: 'PI', code: 'PI' },
    { label: '分段模板', code: '[0,10): y1\n[10,30]: max(y1, y2)\n>30: f1(x)\nelse: y2' },
  ];
}
