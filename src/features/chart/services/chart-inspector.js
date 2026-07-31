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
      sourceGroupIdx: null,
      activeGroup: null,
      openDisplaySettingsDialog: null,
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

  if (brightness >= 0.62) {
    return rgb.darker(2.4).formatHex();
  }
  if (brightness >= 0.52) {
    return rgb.darker(1.5).formatHex();
  }

  return rgb.formatHex();
}

export function setupChartInspector({
  targetWrapper,
  svgSelection,
  group,
  xScale,
  bounds,
  crosshairY,
  openDisplaySettingsDialog,
}) {
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
      <button type="button" class="chart-inspector-context-item" data-action="open-display-settings">画布与显示设置</button>
    `;
    targetWrapper.appendChild(menu);
    state.contextMenu = menu;

    menu.addEventListener('click', (event) => {
      const item = event.target.closest('.chart-inspector-context-item');
      if (!item) return;
      const action = item.getAttribute('data-action');
      if (action === 'show-panel') {
        createInspectorPanel(state.contextX, state.contextY);
      } else if (action === 'open-display-settings') {
        state.openDisplaySettingsDialog?.(state.activeGroup);
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
  const safeSourceGroupIdx = Number.isFinite(Number(group?.sourceGroupIdx))
    ? Number(group.sourceGroupIdx)
    : null;

  if (state.sourceGroupIdx !== safeSourceGroupIdx) {
    if (state.contextMenu && state.contextMenu.isConnected) {
      state.contextMenu.remove();
    }
    state.contextMenu = null;

    state.panels = state.panels.filter(panel => panel && panel.isConnected);
    state.panels.forEach(panel => panel.remove());
    state.panels = [];
    state.currentX = null;
  }

  state.sourceGroupIdx = safeSourceGroupIdx;
  state.activeGroup = group;
  state.openDisplaySettingsDialog = openDisplaySettingsDialog;
  targetWrapper.classList.add('chart-inspector-host');

  const svgNode = svgSelection.node();
  if (!svgNode) return;

  let crosshair = svgSelection.select('.chart-hover-x-line');
  if (crosshair.empty()) {
    crosshair = svgSelection.append('line')
      .attr('class', 'chart-hover-x-line')
      .attr('y1', crosshairY.yTop)
      .attr('y2', crosshairY.yBottom)
      .attr('stroke', '#74675a')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '4,3')
      .style('opacity', 0)
      .style('pointer-events', 'none');
  }

  function computeCellValue(curveIdx, column, xValue) {
    const activeGroup = state.activeGroup || group;
    const curve = activeGroup.curves[curveIdx];
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
      const refCurve = activeGroup.curves[column.refCurveIdx];
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
    const activeGroup = state.activeGroup || group;
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

    const bodyRows = activeGroup.curves.map((curve, idx) => {
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
    const activeGroup = state.activeGroup || group;
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
      refSelect.innerHTML = activeGroup.curves
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
    if (mouseX < bounds.xMin || mouseX > bounds.xMax || mouseY < bounds.yMin || mouseY > bounds.yMax) {
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
