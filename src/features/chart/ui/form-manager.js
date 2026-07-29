import {
  buildDefaultCurveAlias,
  buildDefaultFunctionSource,
  parseSingleFormulaFunction,
  validateGroupCurveAliases,
  validateGroupFormulaDependencies,
  validateFormulaFunctionRuntime,
} from '../../../shared/config/formula-storage.js';

export function initForm(chartConfig, curveGroups, triggerRedraw) {
  const uidPrefix = `${Date.now()}`;
  let uidSeed = 0;

  function nextId(type) {
    uidSeed += 1;
    return `${type}-${uidPrefix}-${uidSeed}`;
  }

  function createDefaultCurve(index = 0) {
    return {
      id: nextId('curve'),
      text: `新曲线 ${index + 1}`,
      alias: buildDefaultCurveAlias(index),
      color: '#1f77b4',
      dataMode: 'points',
      points: '(0,0), (100,100)',
      formulaSource: buildDefaultFunctionSource(index),
    };
  }

  function createDefaultGroup(index = 0) {
    return {
      id: nextId('group'),
      title: `曲线组 ${index + 1}`,
      xName: chartConfig.xVariableName || 'X',
      xUnit: chartConfig.xUnit || '',
      yName: chartConfig.yVariableName || 'Y',
      yUnit: chartConfig.yUnit || '',
      formulaXMin: chartConfig.formulaXMin ?? 0,
      formulaXMax: chartConfig.formulaXMax ?? 100,
      curves: [createDefaultCurve(0)],
    };
  }

  if (!Array.isArray(curveGroups) || curveGroups.length === 0) {
    curveGroups.splice(0, curveGroups.length, createDefaultGroup(0));
  }

  curveGroups.forEach((group, groupIdx) => {
    group.id = group.id || nextId('group');
    group.title = group.title || `曲线组 ${groupIdx + 1}`;
    group.xName = group.xName || chartConfig.xVariableName || 'X';
    group.xUnit = group.xUnit || chartConfig.xUnit || '';
    group.yName = group.yName || chartConfig.yVariableName || 'Y';
    group.yUnit = group.yUnit || chartConfig.yUnit || '';
    group.formulaXMin = Number.isFinite(Number(group.formulaXMin)) ? Number(group.formulaXMin) : (chartConfig.formulaXMin ?? 0);
    group.formulaXMax = Number.isFinite(Number(group.formulaXMax)) ? Number(group.formulaXMax) : (chartConfig.formulaXMax ?? 100);
    if (!Array.isArray(group.curves) || group.curves.length === 0) {
      group.curves = [createDefaultCurve(0)];
    }
    group.curves.forEach((curve, curveIdx) => {
      curve.id = curve.id || nextId('curve');
      curve.text = curve.text || `曲线 ${curveIdx + 1}`;
      curve.alias = String(curve.alias || '').trim() || buildDefaultCurveAlias(curveIdx);
      curve.color = curve.color || '#1f77b4';
      curve.dataMode = curve.dataMode === 'formula' ? 'formula' : 'points';
      curve.points = curve.points || '';
      curve.formulaSource = curve.formulaSource || buildDefaultFunctionSource(curveIdx);
    });
  });

  // 从 config 初始填充表单项
  document.getElementById('input-width').value = chartConfig.width || 800;
  document.getElementById('input-height').value = chartConfig.height || 800;
  document.getElementById('input-showMaxGuideLines').checked = chartConfig.showMaxGuideLines !== false;
  document.getElementById('input-showGrid').checked = chartConfig.showGrid !== false;
  document.getElementById('input-showPoints').checked = chartConfig.showPoints !== false;
  document.getElementById('input-bgcolor').value = chartConfig.chartBackgroundColor || '#fffdf9';
  document.getElementById('input-axis-color').value = chartConfig.axisColor || '#3d3d3a';
  document.getElementById('input-tick-color').value = chartConfig.tickColor || '#6c6a64';
  document.getElementById('input-grid-color').value = chartConfig.gridColor || '#d8d0c4';
  document.getElementById('input-guide-color').value = chartConfig.guideLineColor || '#8e8b82';

  function escapeAttr(value) {
    return String(value || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  const curveContextMenu = document.createElement('div');
  curveContextMenu.className = 'curve-context-menu';
  curveContextMenu.style.display = 'none';
  document.body.appendChild(curveContextMenu);

  let contextMenuSource = null;

  function hideCurveContextMenu() {
    curveContextMenu.style.display = 'none';
    curveContextMenu.innerHTML = '';
    contextMenuSource = null;
  }

  function moveCurveToGroup(fromGroupIdx, fromCurveIdx, targetGroupIdx) {
    if (!curveGroups[fromGroupIdx] || !curveGroups[targetGroupIdx]) return;
    if (!curveGroups[fromGroupIdx].curves[fromCurveIdx]) return;
    if (fromGroupIdx === targetGroupIdx) return;

    const [movedCurve] = curveGroups[fromGroupIdx].curves.splice(fromCurveIdx, 1);
    if (!movedCurve) return;

    curveGroups[targetGroupIdx].curves.push(movedCurve);
    if (curveGroups[fromGroupIdx].curves.length === 0) {
      curveGroups[fromGroupIdx].curves.push(createDefaultCurve(0));
    }

    renderCurveGroups();
    triggerRedraw();
  }

  function showCurveContextMenu(x, y, fromGroupIdx, fromCurveIdx) {
    contextMenuSource = { fromGroupIdx, fromCurveIdx };
    const targets = curveGroups
      .map((group, idx) => ({ idx, title: group.title || `曲线组 ${idx + 1}` }))
      .filter(item => item.idx !== fromGroupIdx);

    curveContextMenu.innerHTML = targets.length > 0
      ? targets.map(item => `
          <button type="button" class="curve-context-item" data-target-group-idx="${item.idx}">
            移入：${escapeAttr(item.title)}
          </button>
        `).join('')
      : '<div class="curve-context-empty">没有可移动的目标曲线组</div>';

    curveContextMenu.style.display = 'block';
    const rect = curveContextMenu.getBoundingClientRect();
    const left = Math.max(8, Math.min(x, window.innerWidth - rect.width - 8));
    const top = Math.max(8, Math.min(y, window.innerHeight - rect.height - 8));
    curveContextMenu.style.left = `${left}px`;
    curveContextMenu.style.top = `${top}px`;
  }

  function renderCurveGroups() {
    const list = document.getElementById('curve-list');
    list.innerHTML = '';

    curveGroups.forEach((group, groupIdx) => {
      const groupCard = document.createElement('div');
      groupCard.className = 'curve-group-card';
      groupCard.setAttribute('data-group-idx', String(groupIdx));

      const curvesHtml = group.curves.map((curve, curveIdx) => {
        const isFormulaMode = curve.dataMode === 'formula';
        return `
          <div class="curve-item-card" draggable="true" data-group-idx="${groupIdx}" data-curve-idx="${curveIdx}">
            <div class="curve-item-head">
              <span class="curve-drag-handle" title="拖拽到其他曲线组">::</span>
              <span class="curve-item-title">Curve ID: ${curveIdx + 1}</span>
              <span class="curve-alias-label">alias</span>
              <input type="text" value="${escapeAttr(curve.alias || buildDefaultCurveAlias(curveIdx))}" class="form-control form-control-sm curve-alias" data-group-idx="${groupIdx}" data-curve-idx="${curveIdx}" placeholder="如 tempA">
              <button type="button" class="btn-toggle-curve collapse-triangle-btn" data-group-idx="${groupIdx}" data-curve-idx="${curveIdx}" aria-label="折叠曲线" aria-expanded="true"></button>
            </div>
            <div class="curve-item-body mt-1">
              <div class="curve-item-toolbar">
                <input type="text" value="${escapeAttr(curve.text)}" class="form-control form-control-sm curve-label" data-group-idx="${groupIdx}" data-curve-idx="${curveIdx}" placeholder="曲线名称">
                <select class="form-select form-select-sm curve-data-mode" data-group-idx="${groupIdx}" data-curve-idx="${curveIdx}">
                  <option value="points" ${isFormulaMode ? '' : 'selected'}>插值点</option>
                  <option value="formula" ${isFormulaMode ? 'selected' : ''}>函数</option>
                </select>
                <input type="color" value="${escapeAttr(curve.color)}" class="form-control form-control-color curve-color" data-group-idx="${groupIdx}" data-curve-idx="${curveIdx}" title="曲线颜色">
                <button type="button" class="btn btn-outline-secondary btn-sm btn-edit-curve-formula" data-group-idx="${groupIdx}" data-curve-idx="${curveIdx}" ${isFormulaMode ? '' : 'disabled'}>编辑函数</button>
                <button type="button" class="btn btn-outline-secondary btn-sm btn-curve-formula-help" data-group-idx="${groupIdx}" title="函数引用帮助">?</button>
                <button type="button" class="btn btn-outline-danger btn-sm btn-del-curve" data-group-idx="${groupIdx}" data-curve-idx="${curveIdx}">删除曲线</button>
              </div>
              <div class="curve-item-points">
                <textarea class="form-control form-control-sm curve-points" style="min-height:72px;resize:vertical;" data-group-idx="${groupIdx}" data-curve-idx="${curveIdx}" ${isFormulaMode ? 'disabled' : ''}>${escapeAttr(curve.points)}</textarea>
              </div>
            </div>
          </div>
        `;
      }).join('');

      groupCard.innerHTML = `
        <div class="curve-group-head">
          <div class="curve-group-title curve-group-title-editable" contenteditable="true" spellcheck="false" tabindex="0" data-group-idx="${groupIdx}">${escapeAttr(group.title || `曲线组 ${groupIdx + 1}`)}</div>
          <div class="d-flex flex-wrap gap-2">
            <button type="button" class="btn-toggle-group collapse-triangle-btn" data-group-idx="${groupIdx}" aria-label="折叠曲线组" aria-expanded="true"></button>
            <button type="button" class="btn btn-outline-danger btn-sm btn-del-group" data-group-idx="${groupIdx}" ${curveGroups.length === 1 ? 'disabled' : ''}>删除曲线组</button>
          </div>
        </div>
        <div class="curve-group-body">
        <div class="curve-group-meta mt-2">
          <div class="curve-group-fields curve-group-fields-main">
            <div class="group-field">
            <label class="form-label mb-1">X轴名称</label>
            <input type="text" class="form-control form-control-sm group-xname" data-group-idx="${groupIdx}" value="${escapeAttr(group.xName)}" placeholder="X">
            </div>
            <div class="group-field">
            <label class="form-label mb-1">X轴单位</label>
            <input type="text" class="form-control form-control-sm group-xunit" data-group-idx="${groupIdx}" value="${escapeAttr(group.xUnit)}" placeholder="单位">
            </div>
            <div class="group-field">
            <label class="form-label mb-1">Y轴名称</label>
            <input type="text" class="form-control form-control-sm group-yname" data-group-idx="${groupIdx}" value="${escapeAttr(group.yName)}" placeholder="Y">
            </div>
            <div class="group-field">
            <label class="form-label mb-1">Y轴单位</label>
            <input type="text" class="form-control form-control-sm group-yunit" data-group-idx="${groupIdx}" value="${escapeAttr(group.yUnit)}" placeholder="单位">
            </div>
          </div>
          <div class="curve-group-fields curve-group-fields-range mt-2">
            <div class="group-field">
            <label class="form-label mb-1">函数X最小</label>
            <input type="number" class="form-control form-control-sm group-xmin" data-group-idx="${groupIdx}" value="${escapeAttr(group.formulaXMin)}">
            </div>
            <div class="group-field">
            <label class="form-label mb-1">函数X最大</label>
            <input type="number" class="form-control form-control-sm group-xmax" data-group-idx="${groupIdx}" value="${escapeAttr(group.formulaXMax)}">
            </div>
          </div>
        </div>
        <div class="group-curves mt-3" data-group-idx="${groupIdx}">
          ${curvesHtml}
        </div>
        <div class="mt-2">
          <button type="button" class="btn btn-outline-primary btn-sm btn-add-curve-in-group" data-group-idx="${groupIdx}">+ 添加曲线</button>
        </div>
        </div>
      `;

      list.appendChild(groupCard);
    });
  }

  document.getElementById('btn-add-curve-group').onclick = function() {
    curveGroups.push(createDefaultGroup(curveGroups.length));
    renderCurveGroups();
    triggerRedraw();
  };

  document.addEventListener('click', function(e) {
    if (!curveContextMenu.contains(e.target)) {
      hideCurveContextMenu();
    }

    const togglePanelBtn = e.target.closest('.settings-collapse-btn');
    if (togglePanelBtn) {
      const panel = togglePanelBtn.closest('.settings-panel');
      if (!panel) return;
      panel.classList.toggle('settings-panel-collapsed');
      const expanded = !panel.classList.contains('settings-panel-collapsed');
      togglePanelBtn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      return;
    }

    const toggleGroupBtn = e.target.closest('.btn-toggle-group');
    if (toggleGroupBtn) {
      const groupCard = toggleGroupBtn.closest('.curve-group-card');
      if (!groupCard) return;
      groupCard.classList.toggle('curve-group-collapsed');
      const expanded = !groupCard.classList.contains('curve-group-collapsed');
      toggleGroupBtn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      return;
    }

    const toggleCurveBtn = e.target.closest('.btn-toggle-curve');
    if (toggleCurveBtn) {
      const curveCard = toggleCurveBtn.closest('.curve-item-card');
      if (!curveCard) return;
      curveCard.classList.toggle('curve-item-collapsed');
      const expanded = !curveCard.classList.contains('curve-item-collapsed');
      toggleCurveBtn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      return;
    }

    const contextItem = e.target.closest('.curve-context-item');
    if (contextItem) {
      if (!contextMenuSource) {
        hideCurveContextMenu();
        return;
      }

      const targetGroupIdx = Number(contextItem.getAttribute('data-target-group-idx'));
      const { fromGroupIdx, fromCurveIdx } = contextMenuSource;
      hideCurveContextMenu();

      if (!Number.isFinite(targetGroupIdx)) return;
      moveCurveToGroup(fromGroupIdx, fromCurveIdx, targetGroupIdx);
      return;
    }

    const addCurveBtn = e.target.closest('.btn-add-curve-in-group');
    if (addCurveBtn) {
      const groupIdx = Number(addCurveBtn.getAttribute('data-group-idx'));
      if (!Number.isFinite(groupIdx) || !curveGroups[groupIdx]) return;
      curveGroups[groupIdx].curves.push(createDefaultCurve(curveGroups[groupIdx].curves.length));
      renderCurveGroups();
      triggerRedraw();
      return;
    }

    const delCurveBtn = e.target.closest('.btn-del-curve');
    if (delCurveBtn) {
      const groupIdx = Number(delCurveBtn.getAttribute('data-group-idx'));
      const curveIdx = Number(delCurveBtn.getAttribute('data-curve-idx'));
      if (!Number.isFinite(groupIdx) || !Number.isFinite(curveIdx) || !curveGroups[groupIdx]) return;

      curveGroups[groupIdx].curves.splice(curveIdx, 1);
      if (curveGroups[groupIdx].curves.length === 0) {
        curveGroups[groupIdx].curves.push(createDefaultCurve(0));
      }
      renderCurveGroups();
      triggerRedraw();
      return;
    }

    const delGroupBtn = e.target.closest('.btn-del-group');
    if (delGroupBtn) {
      const groupIdx = Number(delGroupBtn.getAttribute('data-group-idx'));
      if (!Number.isFinite(groupIdx) || curveGroups.length <= 1) return;
      curveGroups.splice(groupIdx, 1);
      renderCurveGroups();
      triggerRedraw();
      return;
    }
  });

  document.addEventListener('input', function(e) {
    const groupIdx = Number(e.target.getAttribute('data-group-idx'));
    if (!Number.isFinite(groupIdx) || !curveGroups[groupIdx]) return;

    const group = curveGroups[groupIdx];
    const curveIdx = Number(e.target.getAttribute('data-curve-idx'));
    const curve = Number.isFinite(curveIdx) ? group.curves[curveIdx] : null;

    if (e.target.classList.contains('curve-group-title-editable')) {
      group.title = e.target.textContent.trim() || `曲线组 ${groupIdx + 1}`;
      triggerRedraw();
      return;
    }

    if (e.target.classList.contains('group-xname')) group.xName = e.target.value;
    if (e.target.classList.contains('group-xunit')) group.xUnit = e.target.value;
    if (e.target.classList.contains('group-yname')) group.yName = e.target.value;
    if (e.target.classList.contains('group-yunit')) group.yUnit = e.target.value;
    if (e.target.classList.contains('group-xmin')) group.formulaXMin = e.target.value;
    if (e.target.classList.contains('group-xmax')) group.formulaXMax = e.target.value;

    if (!curve) {
      triggerRedraw();
      return;
    }

    if (e.target.classList.contains('curve-label')) curve.text = e.target.value;
    if (e.target.classList.contains('curve-alias')) {
      curve.alias = e.target.value;
      try {
        validateGroupCurveAliases(group.curves);
        e.target.setCustomValidity('');
      } catch (error) {
        e.target.setCustomValidity(error.message);
      }
    }
    if (e.target.classList.contains('curve-points')) curve.points = e.target.value;
    if (e.target.classList.contains('curve-color')) curve.color = e.target.value;

    triggerRedraw();
  });

  document.addEventListener('focusout', function(e) {
    if (e.target.classList.contains('curve-alias')) {
      const groupIdx = Number(e.target.getAttribute('data-group-idx'));
      const curveIdx = Number(e.target.getAttribute('data-curve-idx'));
      if (!Number.isFinite(groupIdx) || !Number.isFinite(curveIdx) || !curveGroups[groupIdx] || !curveGroups[groupIdx].curves[curveIdx]) return;

      const normalized = String(e.target.value || '').trim() || buildDefaultCurveAlias(curveIdx);
      curveGroups[groupIdx].curves[curveIdx].alias = normalized;
      e.target.value = normalized;

      try {
        validateGroupCurveAliases(curveGroups[groupIdx].curves);
        e.target.setCustomValidity('');
      } catch (error) {
        e.target.setCustomValidity(error.message);
      }

      e.target.reportValidity();
      triggerRedraw();
      return;
    }

    if (!e.target.classList.contains('curve-group-title-editable')) return;
    const groupIdx = Number(e.target.getAttribute('data-group-idx'));
    if (!Number.isFinite(groupIdx) || !curveGroups[groupIdx]) return;
    const nextTitle = e.target.textContent.trim() || `曲线组 ${groupIdx + 1}`;
    curveGroups[groupIdx].title = nextTitle;
    e.target.textContent = nextTitle;
    triggerRedraw();
  });

  document.addEventListener('change', function(e) {
    if (!e.target.classList.contains('curve-data-mode')) return;
    const groupIdx = Number(e.target.getAttribute('data-group-idx'));
    const curveIdx = Number(e.target.getAttribute('data-curve-idx'));
    if (!Number.isFinite(groupIdx) || !Number.isFinite(curveIdx) || !curveGroups[groupIdx] || !curveGroups[groupIdx].curves[curveIdx]) return;

    curveGroups[groupIdx].curves[curveIdx].dataMode = e.target.value === 'formula' ? 'formula' : 'points';
    renderCurveGroups();
    triggerRedraw();
  });

  document.getElementById('input-showMaxGuideLines').addEventListener('change', triggerRedraw);
  document.getElementById('input-showGrid').addEventListener('change', triggerRedraw);
  document.getElementById('input-showPoints').addEventListener('change', triggerRedraw);
  document.getElementById('input-bgcolor').addEventListener('change', triggerRedraw);
  document.getElementById('input-axis-color').addEventListener('change', triggerRedraw);
  document.getElementById('input-tick-color').addEventListener('change', triggerRedraw);
  document.getElementById('input-grid-color').addEventListener('change', triggerRedraw);
  document.getElementById('input-guide-color').addEventListener('change', triggerRedraw);

  const formulaModal = document.getElementById('formula-editor-modal');
  const formulaTitle = document.getElementById('formula-editor-title');
  const formulaEditorHost = document.getElementById('formula-code-editor');
  const formulaTextarea = document.getElementById('textarea-formula-code');
  const formulaError = document.getElementById('formula-editor-error');
  const closeFormulaBtn = document.getElementById('btn-formula-cancel');
  const saveFormulaBtn = document.getElementById('btn-formula-save');
  let editingGroupIndex = -1;
  let editingCurveIndex = -1;
  let monacoEditor = null;
  let monacoReadyPromise = null;

  formulaTextarea.addEventListener('keydown', function(e) {
    if (e.key !== 'Tab') return;
    e.preventDefault();
    const start = formulaTextarea.selectionStart;
    const end = formulaTextarea.selectionEnd;
    const value = formulaTextarea.value;
    const insert = '  ';
    formulaTextarea.value = value.slice(0, start) + insert + value.slice(end);
    formulaTextarea.selectionStart = formulaTextarea.selectionEnd = start + insert.length;
  });

  function ensureMonacoEditor() {
    if (monacoEditor) return Promise.resolve(monacoEditor);
    if (monacoReadyPromise) return monacoReadyPromise;

    monacoReadyPromise = new Promise((resolve, reject) => {
      if (!window.require) {
        reject(new Error('Monaco loader 不可用')); return;
      }

      if (!window.monaco) {
        window.require.config({
          paths: {
            vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.52.2/min/vs'
          }
        });
      }

      window.require(['vs/editor/editor.main'], () => {
        try {
          monacoEditor = window.monaco.editor.create(formulaEditorHost, {
            value: '',
            language: 'javascript',
            theme: 'vs-dark',
            automaticLayout: true,
            fontSize: 13,
            lineNumbers: 'on',
            minimap: { enabled: false },
            tabSize: 2,
            insertSpaces: true,
            detectIndentation: false,
            wordWrap: 'on',
            scrollBeyondLastLine: false,
            roundedSelection: false,
            renderWhitespace: 'boundary'
          });
          resolve(monacoEditor);
        } catch (error) {
          reject(error);
        }
      }, err => reject(err));
    });

    return monacoReadyPromise;
  }

  function setEditorValue(text) {
    formulaTextarea.value = text;
    if (monacoEditor) {
      monacoEditor.setValue(text);
    }
  }

  function getEditorValue() {
    if (monacoEditor) {
      return monacoEditor.getValue();
    }
    return formulaTextarea.value;
  }

  function getMonacoSyntaxErrorMessage() {
    if (!monacoEditor || !window.monaco) return '';
    const model = monacoEditor.getModel();
    if (!model) return '';

    const markers = window.monaco.editor.getModelMarkers({ resource: model.uri });
    const syntaxErrors = markers.filter(marker => marker.severity === window.monaco.MarkerSeverity.Error);
    if (syntaxErrors.length === 0) return '';

    const first = syntaxErrors[0];
    return `语法检查失败（第 ${first.startLineNumber} 行）: ${first.message}`;
  }

  function validateFormulaBeforeSave(formulaText) {
    const markerErr = getMonacoSyntaxErrorMessage();
    if (markerErr) {
      throw new Error(markerErr);
    }

    const group = curveGroups[editingGroupIndex];
    const xMin = group ? parseFloat(group.formulaXMin) : 0;
    const xMax = group ? parseFloat(group.formulaXMax) : 100;
    const mid = Number.isFinite(xMin) && Number.isFinite(xMax) ? (xMin + xMax) / 2 : 0;
    const sampleXs = [xMin, mid, xMax].filter(Number.isFinite);

    if (editingGroupIndex < 0 || editingGroupIndex >= curveGroups.length) {
      throw new Error('当前编辑的曲线组索引无效。');
    }
    const groupCurves = curveGroups[editingGroupIndex]?.curves || [];
    if (editingCurveIndex < 0 || editingCurveIndex >= groupCurves.length) {
      throw new Error('当前编辑的曲线索引无效。');
    }

    const nextCurves = groupCurves.map(curve => ({ ...curve }));
    validateGroupCurveAliases(nextCurves);
    nextCurves[editingCurveIndex] = {
      ...nextCurves[editingCurveIndex],
      dataMode: 'formula',
      formulaSource: formulaText,
    };

    const aliasPlaceholders = validateGroupCurveAliases(nextCurves);
    const refScope = { Math };
    nextCurves.forEach((_, idx) => {
      refScope[`x${idx + 1}`] = 0;
      refScope[`y${idx + 1}`] = 0;
      refScope[`f${idx + 1}`] = () => 0;
    });
    Object.keys(aliasPlaceholders).forEach(alias => {
      refScope[alias] = () => 0;
    });

    const fn = parseSingleFormulaFunction(formulaText);
    validateFormulaFunctionRuntime((x) => fn(x, refScope), sampleXs);

    validateGroupFormulaDependencies(nextCurves);
  }

  function openFormulaEditor(groupIdx, curveIdx) {
    editingGroupIndex = groupIdx;
    editingCurveIndex = curveIdx;
    const group = curveGroups[groupIdx];
    const curve = group?.curves[curveIdx];
    formulaTitle.textContent = `函数编辑器（组${groupIdx + 1} 曲线 ${curveIdx + 1}: ${curve ? curve.text : ''}）`;
    setEditorValue(curve?.formulaSource || buildDefaultFunctionSource(curveIdx));
    formulaError.textContent = '';
    formulaModal.classList.add('open');
    formulaModal.setAttribute('aria-hidden', 'false');

    ensureMonacoEditor()
      .then(editor => {
        formulaTextarea.style.display = 'none';
        formulaEditorHost.style.display = 'block';
        editor.setValue(formulaTextarea.value);
        editor.focus();
      })
      .catch(() => {
        formulaEditorHost.style.display = 'none';
        formulaTextarea.style.display = 'block';
        formulaTextarea.focus();
      });
  }

  function closeFormulaEditor() {
    editingGroupIndex = -1;
    editingCurveIndex = -1;
    formulaModal.classList.remove('open');
    formulaModal.setAttribute('aria-hidden', 'true');
  }

  closeFormulaBtn.addEventListener('click', closeFormulaEditor);

  document.addEventListener('click', function(e) {
    const helpBtn = e.target.closest('.btn-curve-formula-help');
    if (helpBtn) {
      const groupIdx = Number(helpBtn.getAttribute('data-group-idx'));
      const group = Number.isFinite(groupIdx) ? curveGroups[groupIdx] : null;
      const curveCount = group?.curves?.length || 0;
      const aliasTips = (group?.curves || []).map((curve, idx) => {
        const alias = String(curve.alias || '').trim() || buildDefaultCurveAlias(idx);
        return `   Curve ID: ${idx + 1} => ${alias}`;
      });
      const lines = [
        '函数帮助',
        '',
        '1) 仍使用箭头函数格式：',
        '   (x) => { return ...; }',
        '',
        '2) 可用引用：',
        '   x  = 当前横坐标',
        `   y1..y${Math.max(curveCount, 1)} = 同组曲线在当前 x 的值`,
        `   f1(x)..f${Math.max(curveCount, 1)}(x) = 同组曲线函数调用（支持 f2(x + 1)）`,
        '   alias(x) = 按曲线 alias 调用，例如 tempA(x)',
        '',
        '3) 当前组 alias：',
        ...(aliasTips.length > 0 ? aliasTips : ['   无']),
        '',
        '4) 示例：',
        '   (x) => { return Math.abs(y1 - y2); }',
        '   (x) => { return f1(x) - tempA(x); }',
        '',
        '5) 注意：禁止循环依赖（例如曲线1依赖曲线2，同时曲线2又依赖曲线1）。'
      ];
      window.alert(lines.join('\n'));
      return;
    }

    if (!e.target.classList.contains('btn-edit-curve-formula')) return;
    const groupIdx = Number(e.target.getAttribute('data-group-idx'));
    const curveIdx = Number(e.target.getAttribute('data-curve-idx'));
    if (!Number.isFinite(groupIdx) || !Number.isFinite(curveIdx)) return;
    openFormulaEditor(groupIdx, curveIdx);
  });

  formulaModal.addEventListener('click', function(e) {
    if (e.target === formulaModal) {
      closeFormulaEditor();
    }
  });

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && formulaModal.classList.contains('open')) {
      closeFormulaEditor();
    }
  });

  saveFormulaBtn.addEventListener('click', function() {
    const formulaText = getEditorValue().trim();

    try {
      validateFormulaBeforeSave(formulaText);
      if (editingGroupIndex < 0 || editingGroupIndex >= curveGroups.length) {
        throw new Error('当前编辑的曲线组索引无效。');
      }
      if (editingCurveIndex < 0 || editingCurveIndex >= curveGroups[editingGroupIndex].curves.length) {
        throw new Error('当前编辑的曲线索引无效。');
      }

      const curve = curveGroups[editingGroupIndex].curves[editingCurveIndex];
      curve.formulaSource = formulaText;
      curve.dataMode = 'formula';

      renderCurveGroups();
      closeFormulaEditor();
      triggerRedraw();
    } catch (error) {
      formulaError.textContent = error.message;
    }
  });

  document.addEventListener('dragstart', function(e) {
    const curveCard = e.target.closest('.curve-item-card');
    if (!curveCard) return;
    const fromGroupIdx = Number(curveCard.getAttribute('data-group-idx'));
    const fromCurveIdx = Number(curveCard.getAttribute('data-curve-idx'));
    if (!Number.isFinite(fromGroupIdx) || !Number.isFinite(fromCurveIdx)) return;

    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', `${fromGroupIdx}:${fromCurveIdx}`);
    curveCard.classList.add('is-dragging');
  });

  document.addEventListener('dragend', function(e) {
    const curveCard = e.target.closest('.curve-item-card');
    if (!curveCard) return;
    curveCard.classList.remove('is-dragging');
    document.querySelectorAll('.group-curves').forEach(node => node.classList.remove('is-drag-over'));
  });

  document.addEventListener('dragover', function(e) {
    const zone = e.target.closest('.group-curves');
    if (!zone) return;
    e.preventDefault();
    zone.classList.add('is-drag-over');
  });

  document.addEventListener('dragleave', function(e) {
    const zone = e.target.closest('.group-curves');
    if (!zone) return;
    if (zone.contains(e.relatedTarget)) return;
    zone.classList.remove('is-drag-over');
  });

  document.addEventListener('contextmenu', function(e) {
    const curveCard = e.target.closest('.curve-item-card');
    if (!curveCard) {
      hideCurveContextMenu();
      return;
    }

    e.preventDefault();
    const fromGroupIdx = Number(curveCard.getAttribute('data-group-idx'));
    const fromCurveIdx = Number(curveCard.getAttribute('data-curve-idx'));
    if (!Number.isFinite(fromGroupIdx) || !Number.isFinite(fromCurveIdx)) return;
    showCurveContextMenu(e.clientX, e.clientY, fromGroupIdx, fromCurveIdx);
  });

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      hideCurveContextMenu();
    }
  });

  window.addEventListener('resize', hideCurveContextMenu);
  document.addEventListener('scroll', hideCurveContextMenu, true);

  document.addEventListener('drop', function(e) {
    const zone = e.target.closest('.group-curves');
    if (!zone) return;
    e.preventDefault();

    const targetGroupIdx = Number(zone.getAttribute('data-group-idx'));
    const transfer = e.dataTransfer.getData('text/plain');
    const [fromGroupText, fromCurveText] = transfer.split(':');
    const fromGroupIdx = Number(fromGroupText);
    const fromCurveIdx = Number(fromCurveText);

    zone.classList.remove('is-drag-over');

    if (!Number.isFinite(targetGroupIdx) || !Number.isFinite(fromGroupIdx) || !Number.isFinite(fromCurveIdx)) return;
    moveCurveToGroup(fromGroupIdx, fromCurveIdx, targetGroupIdx);
  });

  document.getElementById('btn-re-render').addEventListener('click', triggerRedraw);
  renderCurveGroups();
}
