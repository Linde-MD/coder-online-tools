// 配置文件，集中管理所有可调整参数

export const chartConfig = {
  width: 800,
  height: 800,
  chartDrawLayout: 'combined',
  chartTitle: '示例曲线图（仅演示）',
  xVariableName: 'X',
  yVariableName: 'Y',
  xUnit: '',
  yUnit: '',
  showMaxGuideLines: true,
  showGrid: true,
  showPoints: true,
  chartBackgroundColor: '#fffdf9',
  axisColor: '#3d3d3a',
  tickColor: '#6c6a64',
  gridColor: '#d8d0c4',
  guideLineColor: '#8e8b82',
  formulaXMin: 0,
  formulaXMax: 100,
  formulaSampleCount: 200,
  formulaFunctionSources: [
    '(x) => {\n  return 0;\n}',
    '(x) => {\n  return x;\n}',
    '(x) => {\n  return 50 + 20 * Math.sin(x / 12);\n}'
  ],
  formulaFunctionsText: `[
  (x) => {
    return 0;
  },
  (x) => {
    return x;
  },
  (x) => {
    return 50 + 20 * Math.sin(x / 12);
  }
]`,
  curveLabelOffsetX: 8,
  curveLabelOffsetY: -12,
  coordinatePointsStr: [
    '(0, 20), (25, 55), (50, 35), (75, 70), (100, 45)',
    '0 60\n25 30\n50 75\n75 40\n100 80',
    '',
  ],
  chartGroups: [
    {
      title: '示例曲线组 1',
      xName: 'X',
      xUnit: '',
      yName: 'Y',
      yUnit: '',
      formulaXMin: 0,
      formulaXMax: 100,
      curves: [
        {
          color: '#1f77b4',
          text: '示例曲线-括号点',
          alias: 'curve1',
          dataMode: 'points',
          points: '(0, 20), (25, 55), (50, 35), (75, 70), (100, 45)',
          formulaSource: '(x) => {\n  return 0;\n}'
        },
        {
          color: '#d62728',
          text: '示例曲线-两列点',
          alias: 'curve2',
          dataMode: 'points',
          points: '0 60\n25 30\n50 75\n75 40\n100 80',
          formulaSource: '(x) => {\n  return x;\n}'
        },
        {
          color: '#2ca02c',
          text: '示例曲线-公式',
          alias: 'curve3',
          dataMode: 'formula',
          points: '',
          formulaSource: '(x) => {\n  return 50 + 20 * Math.sin(x / 12);\n}'
        }
      ]
    }
  ],
  curveConfigs: [
    { color: '#1f77b4', text: '示例曲线-括号点', dataMode: 'points', yName: 'Y1', yUnit: '' },
    { color: '#d62728', text: '示例曲线-两列点', dataMode: 'points', yName: 'Y2', yUnit: '' },
    { color: '#2ca02c', text: '示例曲线-公式', dataMode: 'formula', yName: 'Y3', yUnit: '' },
  ],
  titleMaxCharsPerLine: 42,
  titleLineHeight: 28,
  titleY: 36,
  marginMinTop: 80,
  marginLeft: 90,
  marginRight: 50,
  marginBottom: 90,
};
