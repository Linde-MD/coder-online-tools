function getControlElements() {
  return {
    width: document.getElementById('input-width'),
    height: document.getElementById('input-height'),
    showMaxGuideLines: document.getElementById('input-showMaxGuideLines'),
    showGrid: document.getElementById('input-showGrid'),
    showPoints: document.getElementById('input-showPoints'),
    bgColor: document.getElementById('input-bgcolor'),
    axisColor: document.getElementById('input-axis-color'),
    tickColor: document.getElementById('input-tick-color'),
    gridColor: document.getElementById('input-grid-color'),
    guideColor: document.getElementById('input-guide-color'),
  };
}

export function initializeChartSettingsInputs(chartConfig) {
  const controls = getControlElements();

  if (controls.width) controls.width.value = chartConfig.width || 800;
  if (controls.height) controls.height.value = chartConfig.height || 800;
  if (controls.showMaxGuideLines) controls.showMaxGuideLines.checked = chartConfig.showMaxGuideLines !== false;
  if (controls.showGrid) controls.showGrid.checked = chartConfig.showGrid !== false;
  if (controls.showPoints) controls.showPoints.checked = chartConfig.showPoints !== false;
  if (controls.bgColor) controls.bgColor.value = chartConfig.chartBackgroundColor || '#fffdf9';
  if (controls.axisColor) controls.axisColor.value = chartConfig.axisColor || '#3d3d3a';
  if (controls.tickColor) controls.tickColor.value = chartConfig.tickColor || '#6c6a64';
  if (controls.gridColor) controls.gridColor.value = chartConfig.gridColor || '#d8d0c4';
  if (controls.guideColor) controls.guideColor.value = chartConfig.guideLineColor || '#8e8b82';
}

export function bindChartSettingsChangeHandlers(onChange) {
  const controls = getControlElements();
  const bindings = [
    [controls.showMaxGuideLines, 'change'],
    [controls.showGrid, 'change'],
    [controls.showPoints, 'change'],
    [controls.bgColor, 'change'],
    [controls.axisColor, 'change'],
    [controls.tickColor, 'change'],
    [controls.gridColor, 'change'],
    [controls.guideColor, 'change'],
  ];

  bindings.forEach(([element, eventName]) => {
    element?.addEventListener(eventName, onChange);
  });

  return {
    dispose() {
      bindings.forEach(([element, eventName]) => {
        element?.removeEventListener(eventName, onChange);
      });
    },
  };
}

export function bindChartActionButtons(options) {
  const { onAddCurveGroup, onReRender } = options;
  const addGroupButton = document.getElementById('btn-add-curve-group');
  const rerenderButton = document.getElementById('btn-re-render');

  if (addGroupButton) {
    addGroupButton.onclick = onAddCurveGroup;
  }

  if (rerenderButton) {
    rerenderButton.addEventListener('click', onReRender);
  }

  return {
    dispose() {
      if (addGroupButton) {
        addGroupButton.onclick = null;
      }
      if (rerenderButton) {
        rerenderButton.removeEventListener('click', onReRender);
      }
    },
  };
}
