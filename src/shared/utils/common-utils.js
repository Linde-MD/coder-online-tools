// 工具函数模块

export function buildAxisLabel(variableName, unit) {
  if (!unit) return variableName;
  return `${variableName} (${unit})`;
}

export function splitTitleLines(title, maxCharsPerLine) {
  if (!title) return [''];
  const words = title.trim().split(/\s+/);
  const lines = [];
  if (words.length > 1) {
    let currentLine = words[0];
    for (let i = 1; i < words.length; i++) {
      const nextLine = `${currentLine} ${words[i]}`;
      if (nextLine.length <= maxCharsPerLine) {
        currentLine = nextLine;
      } else {
        lines.push(currentLine);
        currentLine = words[i];
      }
    }
    lines.push(currentLine);
    return lines;
  }
  for (let i = 0; i < title.length; i += maxCharsPerLine) {
    lines.push(title.slice(i, i + maxCharsPerLine));
  }
  return lines;
}

export function parseCoordinatePoints(pointsStr) {
  if (typeof pointsStr !== 'string') return [];

  // 兼容多种输入格式：
  // 1) (x,y),(x,y)
  // 2) x y（空格/制表符分隔，可多行）
  // 3) x,y,x,y ...
  const numberTokens = pointsStr.match(/-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi);
  if (!numberTokens || numberTokens.length < 2) return [];

  const points = [];

  for (let i = 0; i + 1 < numberTokens.length; i += 2) {
    const x = Number.parseFloat(numberTokens[i]);
    const y = Number.parseFloat(numberTokens[i + 1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    points.push({ x, y });
  }

  return points;
}
