export function buildGroupDataFromCurveGroups(curveGroups, sampleCount, buildGroupCurves) {
  return curveGroups.map((group, groupIdx) => {
    let curves = [];
    try {
      curves = buildGroupCurves(group, sampleCount, groupIdx);
    } catch (error) {
      console.error(`组 ${groupIdx + 1} 配置无效: ${error.message}`);
      curves = (group.curves || []).map(curve => ({
        text: curve.text,
        color: curve.color,
        points: [],
      }));
    }

    return {
      title: group.title,
      xName: group.xName,
      xUnit: group.xUnit,
      yName: group.yName,
      yUnit: group.yUnit,
      curves,
    };
  });
}

export function createChartRenderOptions(chartInputs, groupData) {
  return {
    width: chartInputs.width,
    height: chartInputs.height,
    showMaxGuideLines: chartInputs.showMaxGuideLines,
    showGridLines: chartInputs.showGrid,
    showPoints: chartInputs.showPoints,
    chartBackgroundColor: chartInputs.chartBackgroundColor,
    axisColor: chartInputs.axisColor,
    tickColor: chartInputs.tickColor,
    gridColor: chartInputs.gridColor,
    guideLineColor: chartInputs.guideLineColor,
    groupData,
  };
}

export function applyWrapperSizing(width, height, axisColor) {
  document.querySelectorAll('.svg-resize-wrapper').forEach(wrapper => {
    wrapper.style.width = `${width}px`;
    wrapper.style.height = `${height}px`;
    wrapper.style.setProperty('--chart-axis-color', axisColor);
    wrapper.style.setProperty('--chart-label-bg', 'rgba(255,255,255,0.72)');
  });
}
