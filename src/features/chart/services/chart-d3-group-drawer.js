import * as d3 from 'd3';

export function drawSingleChartGroup({
  svg,
  group,
  targetWrapper,
  margin,
  curveLabelOffsetX,
  curveLabelOffsetY,
  onSetupInspector,
}) {
  const displaySettings = group.displaySettings || {};
  const width = Number(displaySettings.width) || 800;
  const height = Number(displaySettings.height) || 800;
  const showGridLines = displaySettings.showGrid !== false;
  const showPoints = displaySettings.showPoints !== false;
  const chartBackgroundColor = displaySettings.chartBackgroundColor || '#fffdf9';
  const axisColor = displaySettings.axisColor || '#3d3d3a';
  const tickColor = displaySettings.tickColor || '#6c6a64';
  const gridColor = displaySettings.gridColor || '#d8d0c4';

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
  const plotWidth = Math.max(120, width - margin.left - margin.right);
  const plotHeight = Math.max(120, height - margin.top - margin.bottom);

  // Tick density adapts to chart size so enlarged canvases show more granular axes.
  const xTickCount = Math.max(4, Math.min(28, Math.round(plotWidth / 78)));
  const yTickCount = Math.max(4, Math.min(24, Math.round(plotHeight / 62)));

  const xAxis = d3.axisBottom(xScale).ticks(xTickCount);
  const yAxis = d3.axisLeft(yScale).ticks(yTickCount);

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
    svg.append('g')
      .attr('class', 'grid grid-x')
      .attr('transform', `translate(0, ${height - margin.bottom})`)
      .call(d3.axisBottom(xScale).ticks(xTickCount).tickSize(-plotHeight).tickFormat(''))
      .selectAll('line')
      .attr('stroke', gridColor)
      .attr('stroke-dasharray', '2,2');

    svg.append('g')
      .attr('class', 'grid grid-y')
      .attr('transform', `translate(${margin.left}, 0)`)
      .call(d3.axisLeft(yScale).ticks(yTickCount).tickSize(-plotWidth).tickFormat(''))
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

  if (typeof onSetupInspector === 'function') {
    onSetupInspector({
      targetWrapper,
      svgSelection: svg,
      group,
      xScale,
      yTop: margin.top,
      yBottom: height - margin.bottom,
      chartWidth: width,
      chartHeight: height,
    });
  }
}