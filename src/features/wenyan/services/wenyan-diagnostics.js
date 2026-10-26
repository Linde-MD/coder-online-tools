function toPosition(source, offset) {
  const precedingText = source.slice(0, offset);
  const lines = precedingText.split('\n');
  return {
    lineNumber: lines.length,
    column: lines[lines.length - 1].length + 1,
  };
}

const MONACO_ERROR_SEVERITY = 8;

export function createWenyanErrorMarker(message, source) {
  const firstLine = String(source || '').split('\n')[0] || '';
  return {
    severity: MONACO_ERROR_SEVERITY,
    message: String(message || '文言编译失败'),
    startLineNumber: 1,
    endLineNumber: 1,
    startColumn: 1,
    endColumn: Math.max(firstLine.length + 1, 2),
  };
}

export function analyzeWenyanSource(wenyanCore, source) {
  const text = String(source || '');
  if (!text.trim()) return [];
  if (!wenyanCore || typeof wenyanCore.wy2tokens !== 'function') {
    throw new Error('文言语法检查器尚未就绪。');
  }

  const tokens = wenyanCore.wy2tokens(text);
  if (!Array.isArray(tokens)) {
    throw new Error('文言语法检查器返回了无效结果。');
  }

  let searchFrom = 0;
  return tokens
    .filter(token => Array.isArray(token) && token[0] === 'data' && typeof token[1] === 'string')
    .map((token) => {
      const unknownText = token[1];
      const offset = text.indexOf(unknownText, searchFrom);
      if (offset >= 0) searchFrom = offset + unknownText.length;
      const start = toPosition(text, offset >= 0 ? offset : 0);
      const end = toPosition(text, offset >= 0 ? offset + unknownText.length : 1);
      return {
        severity: MONACO_ERROR_SEVERITY,
        message: `无法识别的文言语法：${unknownText}`,
        startLineNumber: start.lineNumber,
        endLineNumber: end.lineNumber,
        startColumn: start.column,
        endColumn: Math.max(end.column, start.column + 1),
      };
    });
}
