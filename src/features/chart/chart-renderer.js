import { chartConfig } from '../../shared/config/chart-config.js';
import {
  normalizeDisplaySettings,
  openChartDisplaySettingsDialog,
} from '@/features/chart/services/chart-display-settings-modal.js';
import { normalizeChartGroups } from '@/features/chart/services/chart-group-normalizer.js';
import { setupChartInspector } from '@/features/chart/services/chart-inspector.js';
import { drawSingleChartGroup } from '@/features/chart/services/chart-d3-group-drawer.js';
import * as d3 from 'd3';

export function renderChart(options = {}) {
  const groupData = Array.isArray(options.groupData) && options.groupData.length > 0
    ? options.groupData
    : [{
        title: chartConfig.chartTitle || '曲线组',
        xName: chartConfig.xVariableName || 'X',
        xUnit: chartConfig.xUnit || '',
        yName: chartConfig.yVariableName || 'Y',
        yUnit: chartConfig.yUnit || '',
        curves: chartConfig.curveConfigs.map((cfg, idx) => ({
          text: cfg.text,
          color: cfg.color,
          pointsStr: chartConfig.coordinatePointsStr[idx],
        })),
      }];

  const marginLeft = chartConfig.marginLeft;
  const marginRight = chartConfig.marginRight;
  const marginBottom = chartConfig.marginBottom;
  const marginMinTop = 40; // 标题因为跑到外面去了，顶部留白可以直接缩小一点
  
  const curveLabelOffsetX = options.curveLabelOffsetX !== undefined ? options.curveLabelOffsetX : (chartConfig.curveLabelOffsetX || 8);
  const curveLabelOffsetY = options.curveLabelOffsetY !== undefined ? options.curveLabelOffsetY : (chartConfig.curveLabelOffsetY || -8);
  const onGroupDisplaySettingsChange = typeof options.onGroupDisplaySettingsChange === 'function'
    ? options.onGroupDisplaySettingsChange
    : null;

  const margin = {
    top: marginMinTop + 14,
    left: marginLeft,
    right: marginRight,
    bottom: marginBottom,
  };

  // 以主 wrapper 为模板，分图模式下为每个子图创建独立 wrapper
  const chartContainer = document.getElementById('chart-svg-container');
  const wrapper = document.getElementById('svg-resize-wrapper');
  if (!chartContainer || !wrapper) return;

  const normalizedGroups = normalizeChartGroups(groupData, chartConfig, d3.schemeCategory10);

  if (normalizedGroups.length === 0) {
    chartContainer.querySelectorAll('.split-svg-resize-wrapper').forEach(node => node.remove());
    wrapper.querySelectorAll('svg').forEach(svgNode => svgNode.remove());
    return;
  }

  function openDisplaySettingsDialog(group) {
    openChartDisplaySettingsDialog({
      group,
      onGroupDisplaySettingsChange,
    });
  }

  function setupInspectorForChart({
    targetWrapper,
    svgSelection,
    group,
    xScale,
    yTop,
    yBottom,
    chartWidth,
    chartHeight,
  }) {
    setupChartInspector({
      targetWrapper,
      svgSelection,
      group,
      xScale,
      bounds: {
        xMin: margin.left,
        xMax: chartWidth - margin.right,
        yMin: margin.top,
        yMax: chartHeight - margin.bottom,
      },
      crosshairY: {
        yTop,
        yBottom,
      },
      openDisplaySettingsDialog,
    });
  }

  const splitWrappers = [wrapper, ...Array.from(chartContainer.querySelectorAll('.split-svg-resize-wrapper'))];
  const requiredWrapperCount = normalizedGroups.length;

  while (splitWrappers.length < requiredWrapperCount) {
    const splitWrapper = document.createElement('div');
    splitWrapper.className = 'svg-resize-wrapper split-svg-resize-wrapper';
    chartContainer.appendChild(splitWrapper);
    splitWrappers.push(splitWrapper);
  }

  while (splitWrappers.length > requiredWrapperCount) {
    const extraWrapper = splitWrappers.pop();
    if (extraWrapper && extraWrapper !== wrapper) {
      extraWrapper.remove();
    }
  }

  splitWrappers.forEach((targetWrapper, index) => {
    const group = normalizedGroups[index];
    const displaySettings = normalizeDisplaySettings(group.displaySettings || {});
    targetWrapper.setAttribute('data-group-idx', String(group.sourceGroupIdx));
    targetWrapper.style.width = `${displaySettings.width}px`;
    targetWrapper.style.height = `${displaySettings.height}px`;
    targetWrapper.style.setProperty('--chart-axis-color', displaySettings.axisColor);
    targetWrapper.style.setProperty('--chart-label-bg', 'rgba(255,255,255,0.72)');
    targetWrapper.querySelectorAll('svg').forEach(svgNode => svgNode.remove());

    const svg = d3.select(targetWrapper)
      .append('svg')
      .attr('height', displaySettings.height)
      .attr('width', displaySettings.width)
      .style('display', 'block');

    drawSingleChartGroup({
      svg,
      group,
      targetWrapper,
      margin,
      curveLabelOffsetX,
      curveLabelOffsetY,
      onSetupInspector: setupInspectorForChart,
    });
  });
}

