import { chartConfig } from '../../shared/config/chart-config.js';
import { parseCoordinatePoints } from '../../shared/utils/common-utils.js';
import * as d3 from 'd3';

export function renderChart(options = {}) {
  // 从 options 中获取或回退到 config
  const width = options.width || chartConfig.width;
  const height = options.height || chartConfig.height;
  const showMaxGuideLines = options.hasOwnProperty('showMaxGuideLines') ? options.showMaxGuideLines : chartConfig.showMaxGuideLines;
  const showGridLines = options.hasOwnProperty('showGridLines') ? options.showGridLines : (chartConfig.showGrid !== false);
  const showPoints = options.hasOwnProperty('showPoints') ? options.showPoints : (chartConfig.showPoints !== false);
  const chartBackgroundColor = options.chartBackgroundColor || chartConfig.chartBackgroundColor || '#fffdf9';
  const axisColor = options.axisColor || chartConfig.axisColor || '#3d3d3a';
  const tickColor = options.tickColor || chartConfig.tickColor || '#6c6a64';
  const gridColor = options.gridColor || chartConfig.gridColor || '#d8d0c4';
  const guideLineColor = options.guideLineColor || chartConfig.guideLineColor || '#8e8b82';
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

  const normalizedGroups = groupData.map((group, groupIdx) => {
    const curves = (group.curves || []).map((dataObj, index) => {
      const points = Array.isArray(dataObj.points)
        ? dataObj.points
        : parseCoordinatePoints(dataObj.pointsStr || '');
      const labelPointIndex = Math.min(points.length - 1, Math.floor(points.length * 0.6));
      return {
        points,
        color: dataObj.color || d3.schemeCategory10[index % 10],
        text: dataObj.text || `Curve ${index + 1}`,
        labelPoint: points[labelPointIndex] || null,
      };
    }).filter(series => series.points.length > 0);

    return {
      title: group.title || `曲线组 ${groupIdx + 1}`,
      xName: group.xName || chartConfig.xVariableName || 'X',
      xUnit: group.xUnit || chartConfig.xUnit || '',
      yName: group.yName || chartConfig.yVariableName || 'Y',
      yUnit: group.yUnit || chartConfig.yUnit || '',
      curves,
    };
  }).filter(group => group.curves.length > 0);

  if (normalizedGroups.length === 0) {
    chartContainer.querySelectorAll('.split-svg-resize-wrapper').forEach(node => node.remove());
    wrapper.querySelectorAll('svg').forEach(svgNode => svgNode.remove());
    return;
  }

  function drawSingleChart(svg, group) {
    svg.append('rect')
      .attr('class', 'chart-bg')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', width)
      .attr('height', height)
      .attr('fill', chartBackgroundColor);

    const allPoints = group.curves.flatMap(series => series.points);
    const xArr = allPoints.map(o => o.x);
    const yArr = allPoints.map(o => o.y);

    const minValidPoints = allPoints.length > 0;
    const xMin = minValidPoints ? Math.min(...xArr) : 0;
    const xMax = minValidPoints ? Math.max(...xArr) : 100;
    const yMin = minValidPoints ? Math.min(...yArr) : 0;
    const yMax = minValidPoints ? Math.max(...yArr) : 100;

    const xScale = d3.scaleLinear()
      .domain([xMin, xMax]).range([margin.left, width - margin.right]);
    const yScale = d3.scaleLinear()
      .domain([yMin, yMax]).range([height - margin.bottom, margin.top]);
    const xAxis = d3.axisBottom(xScale);
    const yAxis = d3.axisLeft(yScale);

    const xLabelText = `${group.xName}${group.xUnit ? ` (${group.xUnit})` : ''}`;
    const yLabelText = `${group.yName}${group.yUnit ? ` (${group.yUnit})` : ''}`;

    svg.append('text')
      .attr('x', width / 2)
      .attr('y', 26)
      .attr('text-anchor', 'middle')
      .style('font-size', '16px')
      .style('font-weight', '700')
      .attr('fill', axisColor)
      .text(group.title);

    if (showGridLines) {
      const plotHeight = height - margin.top - margin.bottom;
      const plotWidth = width - margin.left - margin.right;

      svg.append('g')
        .attr('class', 'grid grid-x')
        .attr('transform', `translate(0, ${height - margin.bottom})`)
        .call(d3.axisBottom(xScale).tickSize(-plotHeight).tickFormat(''))
        .selectAll('line')
        .attr('stroke', gridColor)
        .attr('stroke-dasharray', '2,2');

      svg.append('g')
        .attr('class', 'grid grid-y')
        .attr('transform', `translate(${margin.left}, 0)`)
        .call(d3.axisLeft(yScale).tickSize(-plotWidth).tickFormat(''))
        .selectAll('line')
        .attr('stroke', gridColor)
        .attr('stroke-dasharray', '2,2');

      svg.selectAll('.grid .domain').remove();
    }

    svg.append('g')
      .attr('class', 'xAxis')
      .call(xAxis)
      .attr('transform', `translate(0, ${height - margin.bottom})`);

    svg.append('g')
      .attr('class', 'yAxis')
      .call(yAxis)
      .attr('transform', `translate(${margin.left}, 0)`);

    svg.selectAll('.xAxis .domain, .xAxis .tick line, .yAxis .domain, .yAxis .tick line')
      .attr('stroke', axisColor);

    svg.selectAll('.xAxis .tick text, .yAxis .tick text')
      .attr('fill', tickColor);

    if (showMaxGuideLines) {
      svg.append('line')
        .attr('class', 'maxXGuideLine')
        .attr('x1', xScale(xMax))
        .attr('x2', xScale(xMax))
        .attr('y1', margin.top)
        .attr('y2', height - margin.bottom)
        .attr('stroke', guideLineColor)
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '6,4');

      svg.append('line')
        .attr('class', 'maxYGuideLine')
        .attr('x1', margin.left)
        .attr('x2', width - margin.right)
        .attr('y1', yScale(yMax))
        .attr('y2', yScale(yMax))
        .attr('stroke', guideLineColor)
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '6,4');
    }

    const line = d3.line()
      .x(d => xScale(d.x))
      .y(d => yScale(d.y))
      .curve(d3.curveLinear);

    const seriesGroups = svg.selectAll('.series')
      .data(group.curves)
      .enter()
      .append('g')
      .attr('class', 'series');

    seriesGroups.append('path')
      .attr('class', 'line')
      .attr('d', d => line(d.points))
      .attr('fill', 'none')
      .attr('stroke', d => d.color)
      .attr('stroke-width', 2);

    if (showPoints) {
      seriesGroups.each(function(series) {
        d3.select(this)
          .selectAll('.dot')
          .data(series.points)
          .enter()
          .append('circle')
          .attr('class', 'dot')
          .attr('cx', d => xScale(d.x))
          .attr('cy', d => yScale(d.y))
          .attr('r', 3)
          .attr('fill', series.color);
      });
    }

    seriesGroups.append('text')
      .attr('class', 'curveText')
      .attr('x', d => d.labelPoint ? xScale(d.labelPoint.x) + curveLabelOffsetX : 0)
      .attr('y', d => d.labelPoint ? yScale(d.labelPoint.y) + curveLabelOffsetY : 0)
      .style('font-size', '12px')
      .style('font-weight', 'bold')
      .attr('fill', d => d.color)
      .text(d => d.text);

    svg.append('text')
      .attr('x', width / 2)
      .attr('y', height - 20)
      .attr('text-anchor', 'middle')
      .style('font-size', '13px')
      .style('font-weight', '700')
      .attr('fill', axisColor)
      .text(xLabelText);

    svg.append('text')
      .attr('transform', `translate(24, ${height / 2}) rotate(-90)`)
      .attr('text-anchor', 'middle')
      .style('font-size', '13px')
      .style('font-weight', '700')
      .attr('fill', axisColor)
      .text(yLabelText);
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
    targetWrapper.style.width = `${width}px`;
    targetWrapper.style.height = `${height}px`;
    targetWrapper.querySelectorAll('svg').forEach(svgNode => svgNode.remove());

    const svg = d3.select(targetWrapper)
      .append('svg')
      .attr('height', height)
      .attr('width', width)
      .style('display', 'block');

    drawSingleChart(svg, normalizedGroups[index]);
  });
}

