import { chartConfig } from '../../shared/config/chart-config.js';
import { parseCoordinatePoints } from '../../shared/utils/common-utils.js';
import * as d3 from 'd3';

const chartInspectorState = new WeakMap();

function formatInspectorNumber(value) {
  if (!Number.isFinite(value)) return '-';
  const fixed = Number(value).toFixed(4);
  return fixed.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
}

function interpolateByX(points, x) {
  if (!Array.isArray(points) || points.length === 0 || !Number.isFinite(Number(x))) return null;

  if (points.length === 1) return points[0].y;

  const safeX = Number(x);
  if (safeX <= points[0].x) return points[0].y;
  if (safeX >= points[points.length - 1].x) return points[points.length - 1].y;

  for (let i = 1; i < points.length; i++) {
    const left = points[i - 1];
    const right = points[i];
    if (safeX > right.x) continue;

    const dx = right.x - left.x;
    if (dx === 0) return right.y;

    const t = (safeX - left.x) / dx;
    return left.y + (right.y - left.y) * t;
  }

  return points[points.length - 1].y;
}

function getInspectorState(wrapper) {
  let state = chartInspectorState.get(wrapper);
  if (!state) {
    state = {
      panels: [],
      currentX: null,
      columnSeed: 0,
      contextX: 0,
      contextY: 0,
      contextMenu: null,
    };
    chartInspectorState.set(wrapper, state);
  }
  return state;
}

function getReadableInspectorTextColor(rawColor) {
  const color = d3.color(rawColor);
  if (!color) return '#2d2b28';

  const rgb = d3.rgb(color);
  const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 255000;

  // Very bright colors (e.g. yellow) are darkened for better contrast on light chips.
  if (brightness >= 0.62) {
    return rgb.darker(2.4).formatHex();
  }
  if (brightness >= 0.52) {
    return rgb.darker(1.5).formatHex();
  }

  return rgb.formatHex();
}

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
      const sortedPoints = points
        .map(item => ({ x: Number(item.x), y: Number(item.y) }))
        .filter(item => Number.isFinite(item.x) && Number.isFinite(item.y))
        .sort((a, b) => a.x - b.x);
      const yValues = sortedPoints.map(item => item.y);
      const labelPointIndex = Math.min(points.length - 1, Math.floor(points.length * 0.6));
      return {
        points,
        sortedPoints,
        color: dataObj.color || d3.schemeCategory10[index % 10],
        text: dataObj.text || `Curve ${index + 1}`,
        labelPoint: points[labelPointIndex] || null,
        stats: {
          min: yValues.length ? Math.min(...yValues) : null,
          max: yValues.length ? Math.max(...yValues) : null,
          avg: yValues.length ? (yValues.reduce((acc, item) => acc + item, 0) / yValues.length) : null,
        },
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

  function setupInspectorForChart(targetWrapper, svgSelection, group, xScale, yTop, yBottom) {
        function hideContextMenu() {
          if (!state.contextMenu) return;
          state.contextMenu.style.display = 'none';
        }

        function ensureContextMenu() {
          if (state.contextMenu && state.contextMenu.isConnected) {
            return state.contextMenu;
          }

          const menu = document.createElement('div');
          menu.className = 'chart-inspector-context-menu';
          menu.style.display = 'none';
          menu.innerHTML = `
            <button type="button" class="chart-inspector-context-item" data-action="show-panel">显示观察窗</button>
          `;
          targetWrapper.appendChild(menu);
          state.contextMenu = menu;

          menu.addEventListener('click', (event) => {
            const item = event.target.closest('.chart-inspector-context-item');
            if (!item) return;
            const action = item.getAttribute('data-action');
            if (action === 'show-panel') {
              createInspectorPanel(state.contextX, state.contextY);
            }
            hideContextMenu();
          });

          document.addEventListener('click', (event) => {
            if (!menu.isConnected) return;
            if (menu.contains(event.target)) return;
            hideContextMenu();
          });

          document.addEventListener('scroll', hideContextMenu, true);
          window.addEventListener('resize', hideContextMenu);
          return menu;
        }

        function showContextMenu(clientX, clientY) {
          const menu = ensureContextMenu();
          if (!menu) return;

          state.contextX = clientX;
          state.contextY = clientY;

          const existingPanel = state.panels.find(panel => panel && panel.isConnected);
          const item = menu.querySelector('.chart-inspector-context-item[data-action="show-panel"]');
          if (item) {
            item.textContent = existingPanel ? '显示观察窗（已存在）' : '显示观察窗';
          }

          const wrapperRect = targetWrapper.getBoundingClientRect();
          menu.style.display = 'block';
          const menuRect = menu.getBoundingClientRect();
          const left = Math.max(8, Math.min(clientX - wrapperRect.left, wrapperRect.width - menuRect.width - 8));
          const top = Math.max(8, Math.min(clientY - wrapperRect.top, wrapperRect.height - menuRect.height - 8));
          menu.style.left = `${left + targetWrapper.scrollLeft}px`;
          menu.style.top = `${top + targetWrapper.scrollTop}px`;
        }

    const state = getInspectorState(targetWrapper);
    targetWrapper.classList.add('chart-inspector-host');

    const svgNode = svgSelection.node();
    if (!svgNode) return;

    let crosshair = svgSelection.select('.chart-hover-x-line');
    if (crosshair.empty()) {
      crosshair = svgSelection.append('line')
        .attr('class', 'chart-hover-x-line')
        .attr('y1', yTop)
        .attr('y2', yBottom)
        .attr('stroke', '#74675a')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '4,3')
        .style('opacity', 0)
        .style('pointer-events', 'none');
    }

    function computeCellValue(curveIdx, column, xValue) {
      const curve = group.curves[curveIdx];
      if (!curve) return null;

      if (column.type === 'value') {
        return interpolateByX(curve.sortedPoints, xValue);
      }
      if (column.type === 'min') {
        return curve.stats.min;
      }
      if (column.type === 'max') {
        return curve.stats.max;
      }
      if (column.type === 'avg') {
        return curve.stats.avg;
      }
      if (column.type === 'delta') {
        const base = interpolateByX(curve.sortedPoints, xValue);
        const refCurve = group.curves[column.refCurveIdx];
        const refValue = refCurve ? interpolateByX(refCurve.sortedPoints, xValue) : null;
        if (!Number.isFinite(base) || !Number.isFinite(refValue)) return null;
        return base - refValue;
      }

      return null;
    }

    function getColumnLabel(column) {
      if (column.type === 'value') return '当前值';
      if (column.type === 'min') return '最小值';
      if (column.type === 'max') return '最大值';
      if (column.type === 'avg') return '平均值';
      if (column.type === 'delta') {
        const ref = Number(column.refCurveIdx);
        return Number.isInteger(ref) ? `差值-曲线${ref + 1}` : '差值';
      }
      return '值';
    }

    function buildPanelTable(panel) {
      const xLabel = panel.querySelector('.chart-inspector-x-value');
      if (xLabel) {
        xLabel.textContent = Number.isFinite(state.currentX)
          ? formatInspectorNumber(state.currentX)
          : '-';
      }

      const host = panel.querySelector('.chart-inspector-table-host');
      if (!host) return;

      const columns = panel._columns || [];
      const headCols = columns.map(col => {
        const removable = columns.length > 1
          ? `<button type="button" class="chart-inspector-col-remove" data-col-id="${col.id}" title="删除列">×</button>`
          : '';
        return `<th>${getColumnLabel(col)}${removable}</th>`;
      }).join('');

      const bodyRows = group.curves.map((curve, idx) => {
        const readableCurveColor = getReadableInspectorTextColor(curve.color);
        const cells = columns.map(col => {
          const value = Number.isFinite(state.currentX) ? computeCellValue(idx, col, state.currentX) : null;
          return `<td><span class="chart-inspector-curve-text" style="--curve-color:${curve.color};--curve-text-color:${readableCurveColor};color:${readableCurveColor};">${formatInspectorNumber(value)}</span></td>`;
        }).join('');
        return `<tr><th scope="row"><span class="chart-inspector-curve-text" style="--curve-color:${curve.color};--curve-text-color:${readableCurveColor};color:${readableCurveColor};">${curve.text || `曲线 ${idx + 1}`}</span></th>${cells}</tr>`;
      }).join('');

      host.innerHTML = `
        <div class="table-responsive">
          <table class="table table-sm table-striped mb-0 chart-inspector-table">
            <thead>
              <tr>
                <th>曲线</th>
                ${headCols}
              </tr>
            </thead>
            <tbody>
              ${bodyRows}
            </tbody>
          </table>
        </div>
      `;
    }

    function refreshAllPanels() {
      state.panels = state.panels.filter(panel => panel && panel.isConnected);
      state.panels.forEach(panel => {
        if (!Array.isArray(panel._columns) || panel._columns.length === 0) {
          state.columnSeed += 1;
          panel._columns = [{ id: `col-${state.columnSeed}`, type: 'value' }];
        }
        buildPanelTable(panel);
      });
    }

    function createInspectorPanel(clientX, clientY) {
      const existingPanel = state.panels.find(panel => panel && panel.isConnected);
      if (existingPanel) {
        existingPanel.style.display = 'block';
        existingPanel.style.left = `${Math.max(8, clientX - targetWrapper.getBoundingClientRect().left + targetWrapper.scrollLeft)}px`;
        existingPanel.style.top = `${Math.max(8, clientY - targetWrapper.getBoundingClientRect().top + targetWrapper.scrollTop)}px`;
        return existingPanel;
      }

      state.columnSeed += 1;

      const panel = document.createElement('div');
      panel.className = 'chart-inspector-panel';
      panel.innerHTML = `
        <div class="chart-inspector-head" draggable="false">
          <span class="chart-inspector-title">数据观察窗</span>
          <button type="button" class="chart-inspector-close" title="关闭">×</button>
        </div>
        <div class="chart-inspector-body">
          <div class="chart-inspector-x-row">X: <span class="chart-inspector-x-value">-</span></div>
          <div class="chart-inspector-controls">
            <select class="form-select form-select-sm chart-inspector-metric">
              <option value="value">当前值</option>
              <option value="min">min</option>
              <option value="max">max</option>
              <option value="avg">average</option>
              <option value="delta">与其他曲线差值</option>
            </select>
            <select class="form-select form-select-sm chart-inspector-ref" style="display:none;"></select>
            <button type="button" class="btn btn-outline-secondary btn-sm chart-inspector-add-col">+ 列</button>
          </div>
          <div class="chart-inspector-table-host"></div>
        </div>
      `;
      panel._columns = [{ id: `col-${state.columnSeed}`, type: 'value' }];

      const refSelect = panel.querySelector('.chart-inspector-ref');
      if (refSelect) {
        refSelect.innerHTML = group.curves
          .map((curve, idx) => `<option value="${idx}">${curve.text || `曲线 ${idx + 1}`}</option>`)
          .join('');
      }

      const metricSelect = panel.querySelector('.chart-inspector-metric');
      if (metricSelect && refSelect) {
        metricSelect.addEventListener('change', () => {
          refSelect.style.display = metricSelect.value === 'delta' ? 'block' : 'none';
        });
      }

      const addButton = panel.querySelector('.chart-inspector-add-col');
      if (addButton && metricSelect && refSelect) {
        addButton.addEventListener('click', () => {
          state.columnSeed += 1;
          const nextColumn = {
            id: `col-${state.columnSeed}`,
            type: metricSelect.value,
            refCurveIdx: metricSelect.value === 'delta' ? Number(refSelect.value) : null,
          };
          panel._columns.push(nextColumn);
          buildPanelTable(panel);
        });
      }

      panel.addEventListener('click', (event) => {
        const removeBtn = event.target.closest('.chart-inspector-col-remove');
        if (!removeBtn) return;

        const colId = removeBtn.getAttribute('data-col-id');
        panel._columns = (panel._columns || []).filter(col => col.id !== colId);
        if (panel._columns.length === 0) {
          state.columnSeed += 1;
          panel._columns = [{ id: `col-${state.columnSeed}`, type: 'value' }];
        }
        buildPanelTable(panel);
      });

      const closeBtn = panel.querySelector('.chart-inspector-close');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => {
          panel.remove();
          state.panels = state.panels.filter(item => item !== panel);
        });
      }

      const wrapperRect = targetWrapper.getBoundingClientRect();
      const left = clientX - wrapperRect.left + targetWrapper.scrollLeft;
      const top = clientY - wrapperRect.top + targetWrapper.scrollTop;
      panel.style.left = `${Math.max(8, left)}px`;
      panel.style.top = `${Math.max(8, top)}px`;

      const head = panel.querySelector('.chart-inspector-head');
      if (head) {
        let dragOffsetX = 0;
        let dragOffsetY = 0;
        let dragging = false;

        head.addEventListener('mousedown', (event) => {
          if (event.button !== 0) return;
          dragging = true;
          const panelRect = panel.getBoundingClientRect();
          dragOffsetX = event.clientX - panelRect.left;
          dragOffsetY = event.clientY - panelRect.top;
          event.preventDefault();
        });

        window.addEventListener('mousemove', (event) => {
          if (!dragging) return;
          const hostRect = targetWrapper.getBoundingClientRect();
          const nextLeft = event.clientX - hostRect.left - dragOffsetX + targetWrapper.scrollLeft;
          const nextTop = event.clientY - hostRect.top - dragOffsetY + targetWrapper.scrollTop;
          panel.style.left = `${Math.max(8, nextLeft)}px`;
          panel.style.top = `${Math.max(8, nextTop)}px`;
        });

        window.addEventListener('mouseup', () => {
          dragging = false;
        });
      }

      targetWrapper.appendChild(panel);
      state.panels = [panel];
      buildPanelTable(panel);
      return panel;
    }

    svgSelection.on('mousemove.chart-inspector', (event) => {
      const [mouseX, mouseY] = d3.pointer(event, svgNode);
      const xMin = margin.left;
      const xMax = width - margin.right;
      const yMin = margin.top;
      const yMax = height - margin.bottom;

      if (mouseX < xMin || mouseX > xMax || mouseY < yMin || mouseY > yMax) {
        crosshair.style('opacity', 0);
        state.currentX = null;
        refreshAllPanels();
        return;
      }

      state.currentX = xScale.invert(mouseX);
      crosshair
        .attr('x1', mouseX)
        .attr('x2', mouseX)
        .style('opacity', 1);
      refreshAllPanels();
    });

    svgSelection.on('mouseleave.chart-inspector', () => {
      crosshair.style('opacity', 0);
      state.currentX = null;
      refreshAllPanels();
    });

    svgSelection.on('contextmenu.chart-inspector', (event) => {
      event.preventDefault();
      showContextMenu(event.clientX, event.clientY);
    });

    refreshAllPanels();
  }

  function drawSingleChart(svg, group, targetWrapper) {
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

    // 根据绘图区像素宽高动态调整刻度数量：拖拽放大后，刻度和网格会更密集。
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

    setupInspectorForChart(targetWrapper, svg, group, xScale, margin.top, height - margin.bottom);
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

    drawSingleChart(svg, normalizedGroups[index], targetWrapper);
  });
}

