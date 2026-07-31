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
      sourceGroupIdx: groupIdx,
      title: group.title,
      xName: group.xName,
      xUnit: group.xUnit,
      yName: group.yName,
      yUnit: group.yUnit,
      displaySettings: group.displaySettings,
      curves,
    };
  });
}

export function createChartRenderOptions(groupData, onGroupDisplaySettingsChange) {
  return {
    groupData,
    onGroupDisplaySettingsChange,
  };
}
