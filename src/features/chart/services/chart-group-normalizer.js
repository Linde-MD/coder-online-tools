import { parseCoordinatePoints } from '@/shared/utils/common-utils.js';
import { normalizeDisplaySettings } from '@/features/chart/services/chart-display-settings-modal.js';

function normalizeSeriesPoints(dataObj = {}) {
  const points = Array.isArray(dataObj.points)
    ? dataObj.points
    : parseCoordinatePoints(dataObj.pointsStr || '');

  const sortedPoints = points
    .map(item => ({ x: Number(item.x), y: Number(item.y) }))
    .filter(item => Number.isFinite(item.x) && Number.isFinite(item.y))
    .sort((a, b) => a.x - b.x);

  return {
    points,
    sortedPoints,
  };
}

function buildSeriesStats(sortedPoints = []) {
  const yValues = sortedPoints.map(item => item.y);
  return {
    min: yValues.length ? Math.min(...yValues) : null,
    max: yValues.length ? Math.max(...yValues) : null,
    avg: yValues.length ? (yValues.reduce((acc, item) => acc + item, 0) / yValues.length) : null,
  };
}

export function normalizeChartGroups(groupData = [], chartCfg, colorPalette = []) {
  const palette = Array.isArray(colorPalette) && colorPalette.length > 0
    ? colorPalette
    : ['#1f77b4'];

  return groupData.map((group, groupIdx) => {
    const curves = (group.curves || []).map((dataObj, curveIdx) => {
      const { points, sortedPoints } = normalizeSeriesPoints(dataObj);
      const labelPointIndex = Math.min(points.length - 1, Math.floor(points.length * 0.6));

      return {
        points,
        sortedPoints,
        color: dataObj.color || palette[curveIdx % palette.length],
        text: dataObj.text || `Curve ${curveIdx + 1}`,
        labelPoint: points[labelPointIndex] || null,
        stats: buildSeriesStats(sortedPoints),
      };
    }).filter(series => series.points.length > 0);

    return {
      title: group.title || `曲线组 ${groupIdx + 1}`,
      xName: group.xName || chartCfg.xVariableName || 'X',
      xUnit: group.xUnit || chartCfg.xUnit || '',
      yName: group.yName || chartCfg.yVariableName || 'Y',
      yUnit: group.yUnit || chartCfg.yUnit || '',
      sourceGroupIdx: Number.isFinite(Number(group.sourceGroupIdx)) ? Number(group.sourceGroupIdx) : groupIdx,
      displaySettings: normalizeDisplaySettings(group.displaySettings || {}),
      curves,
    };
  }).filter(group => group.curves.length > 0);
}
