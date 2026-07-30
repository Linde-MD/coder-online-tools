export function buildCurveHelpMessage(curveGroups, groupIdx, curveIdx, buildDefaultCurveAlias) {
  const group = Number.isFinite(groupIdx) ? curveGroups[groupIdx] : null;
  const curve = Number.isFinite(curveIdx) && group?.curves ? group.curves[curveIdx] : null;

  if (!curve) {
    return '未找到当前曲线。';
  }

  if (curve.dataMode !== 'formula') {
    return [
      '插值点帮助',
      '',
      '1) 支持两种常用输入格式：',
      '   (0, 10), (10, 30), (20, 25)',
      '   0 10',
      '   10 30',
      '   20 25',
      '',
      '2) 每个点表示一个 (x, y) 坐标。',
      '3) 点与点之间按线性插值计算。',
      '4) 建议 x 值从小到大填写，便于阅读和维护。',
    ].join('\n');
  }

  const curveCount = group?.curves?.length || 0;
  const aliasTips = (group?.curves || []).map((groupCurve, idx) => {
    const alias = String(groupCurve.alias || '').trim() || buildDefaultCurveAlias(idx);
    return `   Curve ID: ${idx + 1} => ${alias}`;
  });

  return [
    '函数帮助',
    '',
    '1) 可用引用：',
    '   x  = 当前横坐标',
    `   y1..y${Math.max(curveCount, 1)} = 同组曲线在当前 x 的值`,
    `   f1(x)..f${Math.max(curveCount, 1)}(x) = 同组曲线函数调用（支持 f2(x + 1)）`,
    '   alias(x) = 按曲线 alias 调用，例如 tempA(x)',
    '',
    '2) 当前组 alias：',
    ...(aliasTips.length > 0 ? aliasTips : ['   无']),
    '',
    '3) 示例：',
    '   (x) => { return Math.abs(y1 - y2); }',
    '   (x) => { return f1(x) - tempA(x); }',
    '',
    '4) 注意：禁止循环依赖（例如曲线1依赖曲线2，同时曲线2又依赖曲线1）。',
  ].join('\n');
}
