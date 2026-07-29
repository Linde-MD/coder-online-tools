export function initLabels() {
  const titleInput = document.getElementById('input-title');
  const titleContainer = document.getElementById('chart-title-container');
  const titleMenuBtn = document.getElementById('btn-title-menu');
  const titleMenu = document.getElementById('title-menu');
  const titleFontSizeInput = document.getElementById('input-title-fontsize');

  let titleWidth = 600;
  let isResizingTitle = false;
  let startX = 0;
  let startWidth = 600;

  function renderTitle() {
    titleContainer.innerHTML = '';
    const outer = document.createElement('div');
    outer.style.display = 'inline-flex';
    outer.style.alignItems = 'center';
    outer.style.justifyContent = 'center';
    outer.style.width = titleWidth + 'px';
    outer.style.minWidth = '120px';
    outer.style.maxWidth = '1000px';

    const div = document.createElement('div');
    div.contentEditable = true;
    div.textContent = titleInput.value;
    div.style.display = 'inline-block';
    div.style.width = '100%';
    div.style.fontSize = titleFontSizeInput.value + 'px';
    div.style.fontWeight = 'bold';
    div.style.textAlign = 'center';
    div.style.wordBreak = 'break-word';
    div.style.outline = 'none';
    div.id = 'editable-title';

    const handle = document.createElement('span');
    handle.style.display = 'none';
    handle.style.width = '12px';
    handle.style.height = '100%';
    handle.style.cursor = 'ew-resize';
    handle.style.verticalAlign = 'middle';
    handle.style.marginLeft = '4px';
    handle.title = '拖拽调整标题宽度';
    handle.innerHTML = '⋮';
    handle.onmousedown = e => {
      isResizingTitle = true;
      startX = e.clientX;
      startWidth = titleWidth;
      e.preventDefault();
    };
    outer.appendChild(div);
    outer.appendChild(handle);
    outer.addEventListener('mouseenter', () => { handle.style.display = 'inline-block'; outer.style.boxShadow = '0 0 0 2px #bbb'; });
    outer.addEventListener('mouseleave', () => { if (!isResizingTitle) handle.style.display = 'none'; outer.style.boxShadow = 'none'; });
    titleContainer.appendChild(outer);
  }

  renderTitle();

  titleInput.addEventListener('input', function() {
    const editable = document.getElementById('editable-title');
    if (editable) editable.textContent = titleInput.value;
  });
  titleFontSizeInput.addEventListener('input', renderTitle);

  document.addEventListener('mousemove', function(e) {
    if (isResizingTitle) {
      let dx = e.clientX - startX;
      titleWidth = Math.max(120, Math.min(1000, startWidth + dx));
      renderTitle();
    }
  });
  document.addEventListener('mouseup', function() { isResizingTitle = false; });

  titleMenuBtn.addEventListener('click', function(e) {
    titleMenu.style.display = titleMenu.style.display === 'none' ? 'block' : 'none';
    const rect = titleMenuBtn.getBoundingClientRect();
    titleMenu.style.left = rect.left + 'px';
    titleMenu.style.top = (rect.bottom + 4) + 'px';
    e.stopPropagation();
  });
  document.addEventListener('click', function(e) {
    if (!titleMenu.contains(e.target) && e.target !== titleMenuBtn) {
      titleMenu.style.display = 'none';
    }
  });

  titleContainer.addEventListener('input', function(e) {
    if (e.target.id === 'editable-title') {
      titleInput.value = e.target.textContent;
    }
  });

  const xNameInput = document.getElementById('input-xname');
  const xUnitInput = document.getElementById('input-xunit');
  const yNameInput = document.getElementById('input-yname');
  const yUnitInput = document.getElementById('input-yunit');

  let xLabelWidth = null;
  let yLabelHeight = null;
  let isResizingXLabel = false;
  let isResizingYLabel = false;
  let startXLabelX = 0;
  let startYLabelY = 0;
  let startXLabelWidth = 0;
  let startYLabelHeight = 0;
  let startYLabelWidth = 0;

  function updateAxisLabels() {
    const svgWrapper = document.getElementById('svg-resize-wrapper');
    if (!svgWrapper) return;
    const wrappers = Array.from(document.querySelectorAll('.svg-resize-wrapper'));
    const drawLayout = document.querySelector('input[name="chart-draw-layout"]:checked')?.value || 'combined';

    let xOuter = document.getElementById('svg-x-label-outer');
    if (!xOuter) {
      xOuter = document.createElement('div');
      xOuter.id = 'svg-x-label-outer';
      xOuter.style.position = 'absolute';
      xOuter.style.left = '50%';
      xOuter.style.bottom = '8px';
      xOuter.style.transform = 'translateX(-50%)';
      xOuter.style.display = 'inline-flex';
      xOuter.style.alignItems = 'center';
      xOuter.style.justifyContent = 'center';
      xOuter.style.background = 'rgba(255,255,255,0.7)';
      xOuter.style.borderRadius = '4px';
      xOuter.style.padding = '0 4px';
      xOuter.style.transition = 'box-shadow 0.2s';
      
      const xLabel = document.createElement('div');
      xLabel.id = 'svg-x-label';
      xLabel.contentEditable = true;
      xLabel.style.fontSize = '14px';
      xLabel.style.fontWeight = 'bold';
      xLabel.style.textAlign = 'center';
      xLabel.style.outline = 'none';
      xLabel.style.flex = '1';
      xLabel.style.minWidth = '0';
      xLabel.style.whiteSpace = 'nowrap';
      xLabel.style.overflow = 'hidden';
      xLabel.style.textOverflow = 'ellipsis';
      xOuter.appendChild(xLabel);

      const handle = document.createElement('span');
      handle.style.display = 'none';
      handle.style.width = '12px';
      handle.style.height = '100%';
      handle.style.cursor = 'ew-resize';
      handle.style.marginLeft = '4px';
      handle.title = '拖拽调整宽度';
      handle.innerHTML = '⋮';
      handle.onmousedown = e => {
        isResizingXLabel = true;
        startXLabelX = e.clientX;
        startXLabelWidth = xOuter.offsetWidth;
        e.preventDefault();
        e.stopPropagation();
      };
      xOuter.appendChild(handle);
      
      xOuter.addEventListener('mouseenter', () => { handle.style.display = 'inline-block'; xOuter.style.boxShadow = '0 0 0 2px #bbb'; });
      xOuter.addEventListener('mouseleave', () => { if (!isResizingXLabel) handle.style.display = 'none'; xOuter.style.boxShadow = 'none'; });

      svgWrapper.appendChild(xOuter);
    }

    let yOuter = document.getElementById('svg-y-label-outer');
    if (!yOuter) {
      yOuter = document.createElement('div');
      yOuter.id = 'svg-y-label-outer';
      yOuter.style.position = 'absolute';
      yOuter.style.left = '24px';
      yOuter.style.top = '50%';
      yOuter.style.transform = 'translate(-50%, -50%) rotate(-90deg)';
      yOuter.style.transformOrigin = 'center';
      yOuter.style.display = 'inline-flex';
      yOuter.style.alignItems = 'center';
      yOuter.style.justifyContent = 'center';
      yOuter.style.flexDirection = 'row';
      yOuter.style.background = 'rgba(255,255,255,0.7)';
      yOuter.style.borderRadius = '4px';
      yOuter.style.padding = '0 4px';
      yOuter.style.transition = 'box-shadow 0.2s';

      const yLabel = document.createElement('div');
      yLabel.id = 'svg-y-label';
      yLabel.contentEditable = true;
      yLabel.style.fontSize = '14px';
      yLabel.style.fontWeight = 'bold';
      yLabel.style.textAlign = 'center';
      yLabel.style.outline = 'none';
      yLabel.style.minWidth = '40px';
      yLabel.style.flex = '1';
      yLabel.style.minWidth = '0';
      yLabel.style.whiteSpace = 'nowrap';
      yLabel.style.overflow = 'hidden';
      yLabel.style.textOverflow = 'ellipsis';
      yOuter.appendChild(yLabel);

      const handle = document.createElement('span');
      handle.style.display = 'none';
      handle.style.width = '12px';
      handle.style.height = '100%';
      handle.style.cursor = 'ns-resize';
      handle.style.marginLeft = '4px';
      handle.title = '拖拽调整显示高度';
      handle.innerHTML = '⋮';
      handle.onmousedown = e => {
        isResizingYLabel = true;
        startYLabelY = e.clientY;
        startYLabelWidth = yOuter.offsetWidth;
        e.preventDefault();
        e.stopPropagation();
      };
      handle.style.zIndex = 10;
      yOuter.appendChild(handle);
      
      yOuter.addEventListener('mouseenter', () => { handle.style.display = 'inline-block'; yOuter.style.boxShadow = '0 0 0 2px #bbb'; });
      yOuter.addEventListener('mouseleave', () => { if (!isResizingYLabel) handle.style.display = 'none'; yOuter.style.boxShadow = 'none'; });

      svgWrapper.appendChild(yOuter);
    }

    const newXText = xNameInput.value + (xUnitInput.value ? ` (${xUnitInput.value})` : '');
    const xLabel = document.getElementById('svg-x-label');
    if (xLabel && xLabel.textContent !== newXText && document.activeElement !== xLabel) {
      xLabel.textContent = newXText;
    }

    const newYText = yNameInput.value + (yUnitInput.value ? ` (${yUnitInput.value})` : '');
    const yLabel = document.getElementById('svg-y-label');
    if (yLabel && yLabel.textContent !== newYText && document.activeElement !== yLabel) {
      yLabel.textContent = newYText;
    }

    if (xLabelWidth) xOuter.style.width = xLabelWidth + 'px';
    if (yLabelHeight) yOuter.style.width = yLabelHeight + 'px';

    if (drawLayout === 'split') {
      yOuter.style.display = 'none';
      wrappers.forEach(targetWrapper => {
        let splitYOuter = targetWrapper.querySelector('.split-svg-y-label-outer');
        if (!splitYOuter) {
          splitYOuter = document.createElement('div');
          splitYOuter.className = 'split-svg-y-label-outer';
          splitYOuter.style.position = 'absolute';
          splitYOuter.style.left = '24px';
          splitYOuter.style.top = '50%';
          splitYOuter.style.transform = 'translate(-50%, -50%) rotate(-90deg)';
          splitYOuter.style.transformOrigin = 'center';
          splitYOuter.style.display = 'inline-flex';
          splitYOuter.style.alignItems = 'center';
          splitYOuter.style.justifyContent = 'center';
          splitYOuter.style.padding = '0 4px';
          splitYOuter.style.borderRadius = '4px';

          const splitYLabel = document.createElement('div');
          splitYLabel.className = 'split-svg-y-label';
          splitYLabel.style.fontSize = '14px';
          splitYLabel.style.fontWeight = 'bold';
          splitYLabel.style.textAlign = 'center';
          splitYLabel.style.whiteSpace = 'nowrap';
          splitYOuter.appendChild(splitYLabel);

          targetWrapper.appendChild(splitYOuter);
        }

        const splitYLabel = splitYOuter.querySelector('.split-svg-y-label');
        if (splitYLabel) {
          const wrapperYName = targetWrapper.dataset.yAxisName || yNameInput.value;
          const wrapperYUnit = targetWrapper.dataset.yAxisUnit || '';
          splitYLabel.textContent = wrapperYName + (wrapperYUnit ? ` (${wrapperYUnit})` : '');
        }
      });
      return;
    }

    yOuter.style.display = 'inline-flex';
    wrappers.forEach(targetWrapper => {
      targetWrapper.querySelectorAll('.split-svg-y-label-outer').forEach(node => node.remove());
    });
  }

  document.addEventListener('mousemove', function(e) {
    if (isResizingXLabel) {
      let dx = e.clientX - startXLabelX;
      xLabelWidth = Math.max(60, startXLabelWidth + dx);
      updateAxisLabels();
    }
    if (isResizingYLabel) {
      let dy = e.clientY - startYLabelY;
      yLabelHeight = Math.max(60, startYLabelWidth - dy); 
      updateAxisLabels();
    }
  });
  document.addEventListener('mouseup', function() {
    isResizingXLabel = false;
    isResizingYLabel = false;
  });

  xNameInput.addEventListener('input', updateAxisLabels);
  xUnitInput.addEventListener('input', updateAxisLabels);
  yNameInput.addEventListener('input', updateAxisLabels);
  yUnitInput.addEventListener('input', updateAxisLabels);

  document.addEventListener('input', function(e) {
    if (e.target.id === 'svg-x-label') {
      const match = e.target.textContent.match(/^(.*?)\s*\((.*?)\)$/);
      if (match) {
        xNameInput.value = match[1];
        xUnitInput.value = match[2];
      } else {
        xNameInput.value = e.target.textContent;
        xUnitInput.value = '';
      }
    }
    if (e.target.id === 'svg-y-label') {
      const match = e.target.textContent.match(/^(.*?)\s*\((.*?)\)$/);
      if (match) {
        yNameInput.value = match[1];
        yUnitInput.value = match[2];
      } else {
        yNameInput.value = e.target.textContent;
        yUnitInput.value = '';
      }
    }
  });

  return { updateAxisLabels };
}
