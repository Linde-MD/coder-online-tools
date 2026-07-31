import { chartConfig } from '@/shared/config/chart-config.js';

function clampSize(value, fallback) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(200, Math.min(2400, Math.round(value)));
}

export function normalizeDisplaySettings(rawSettings = {}) {
  const width = Number(rawSettings.width);
  const height = Number(rawSettings.height);

  return {
    width: Number.isFinite(width) ? width : (chartConfig.width || 800),
    height: Number.isFinite(height) ? height : (chartConfig.height || 800),
    showGrid: typeof rawSettings.showGrid === 'boolean'
      ? rawSettings.showGrid
      : (chartConfig.showGrid !== false),
    showPoints: typeof rawSettings.showPoints === 'boolean'
      ? rawSettings.showPoints
      : (chartConfig.showPoints !== false),
    chartBackgroundColor: rawSettings.chartBackgroundColor || chartConfig.chartBackgroundColor || '#fffdf9',
    axisColor: rawSettings.axisColor || chartConfig.axisColor || '#3d3d3a',
    tickColor: rawSettings.tickColor || chartConfig.tickColor || '#6c6a64',
    gridColor: rawSettings.gridColor || chartConfig.gridColor || '#d8d0c4',
  };
}

function ensureChartDisplaySettingsModal() {
  let modal = document.getElementById('chart-display-settings-modal');
  if (modal) return modal;

  modal = document.createElement('div');
  modal.id = 'chart-display-settings-modal';
  modal.className = 'chart-display-settings-modal';
  modal.setAttribute('aria-hidden', 'true');
  modal.innerHTML = `
    <div class="chart-display-settings-card" role="dialog" aria-modal="true" aria-labelledby="chart-display-settings-title">
      <div class="chart-display-settings-head">
        <h3 id="chart-display-settings-title" class="chart-display-settings-title">画布与显示设置</h3>
        <button type="button" class="chart-display-settings-close" data-action="close" aria-label="关闭">×</button>
      </div>
      <div class="chart-display-settings-body">
        <div class="chart-display-settings-grid">
          <label class="chart-display-settings-field">
            <span>宽度</span>
            <input id="chart-display-width" type="number" min="200" max="2400" class="form-control form-control-sm">
          </label>
          <label class="chart-display-settings-field">
            <span>高度</span>
            <input id="chart-display-height" type="number" min="200" max="2400" class="form-control form-control-sm">
          </label>
          <label class="chart-display-settings-field chart-display-settings-switch">
            <input id="chart-display-show-grid" type="checkbox" class="form-check-input">
            <span>显示背景网格</span>
          </label>
          <label class="chart-display-settings-field chart-display-settings-switch">
            <input id="chart-display-show-points" type="checkbox" class="form-check-input">
            <span>显示采样点标记</span>
          </label>
          <label class="chart-display-settings-field">
            <span>背景色</span>
            <input id="chart-display-bg-color" type="color" class="form-control form-control-color">
          </label>
          <label class="chart-display-settings-field">
            <span>坐标轴色</span>
            <input id="chart-display-axis-color" type="color" class="form-control form-control-color">
          </label>
          <label class="chart-display-settings-field">
            <span>刻度字色</span>
            <input id="chart-display-tick-color" type="color" class="form-control form-control-color">
          </label>
          <label class="chart-display-settings-field">
            <span>网格线色</span>
            <input id="chart-display-grid-color" type="color" class="form-control form-control-color">
          </label>
        </div>
      </div>
      <div class="chart-display-settings-actions">
        <button type="button" class="btn" data-action="close">取消</button>
        <button type="button" class="btn btn-success" data-action="save">保存并应用</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  function readModalSettings(baseSettings = {}) {
    const widthValue = Number(document.getElementById('chart-display-width')?.value);
    const heightValue = Number(document.getElementById('chart-display-height')?.value);

    return {
      width: clampSize(widthValue, baseSettings.width ?? 800),
      height: clampSize(heightValue, baseSettings.height ?? 800),
      showGrid: Boolean(document.getElementById('chart-display-show-grid')?.checked),
      showPoints: Boolean(document.getElementById('chart-display-show-points')?.checked),
      chartBackgroundColor: document.getElementById('chart-display-bg-color')?.value || baseSettings.chartBackgroundColor || '#fffdf9',
      axisColor: document.getElementById('chart-display-axis-color')?.value || baseSettings.axisColor || '#3d3d3a',
      tickColor: document.getElementById('chart-display-tick-color')?.value || baseSettings.tickColor || '#6c6a64',
      gridColor: document.getElementById('chart-display-grid-color')?.value || baseSettings.gridColor || '#d8d0c4',
    };
  }

  function closeModal(shouldRestore) {
    if (shouldRestore && typeof modal._onPreview === 'function' && modal._initialSettings) {
      modal._onPreview({ ...modal._initialSettings });
    }

    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
  }

  function handlePreviewInput() {
    if (typeof modal._onPreview !== 'function') return;
    const baseSettings = modal._workingSettings || modal._initialSettings || {};
    const nextSettings = readModalSettings(baseSettings);
    modal._workingSettings = { ...nextSettings };
    modal._onPreview(nextSettings);
  }

  let sizePreviewTimer = null;
  function handleSizePreviewInput() {
    if (sizePreviewTimer) {
      clearTimeout(sizePreviewTimer);
    }
    sizePreviewTimer = setTimeout(() => {
      sizePreviewTimer = null;
      handlePreviewInput();
    }, 100);
  }

  modal.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action]');
    const action = button?.getAttribute('data-action');
    if (action === 'close' || event.target === modal) {
      closeModal(true);
      return;
    }

    if (action !== 'save' || typeof modal._onSave !== 'function') return;

    const nextSettings = readModalSettings(modal._workingSettings || modal._initialSettings || {});
    modal._onSave(nextSettings);
    closeModal(false);
  });

  const immediatePreviewBindings = [
    ['chart-display-show-grid', 'change'],
    ['chart-display-show-points', 'change'],
    ['chart-display-bg-color', 'input'],
    ['chart-display-axis-color', 'input'],
    ['chart-display-tick-color', 'input'],
    ['chart-display-grid-color', 'input'],
  ];

  const sizePreviewBindings = [
    ['chart-display-width', 'input'],
    ['chart-display-height', 'input'],
  ];

  immediatePreviewBindings.forEach(([id, eventName]) => {
    const input = document.getElementById(id);
    input?.addEventListener(eventName, handlePreviewInput);
  });

  sizePreviewBindings.forEach(([id, eventName]) => {
    const input = document.getElementById(id);
    input?.addEventListener(eventName, handleSizePreviewInput);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (!modal.classList.contains('open')) return;
    closeModal(true);
  });

  return modal;
}

export function openChartDisplaySettingsDialog({ group, onGroupDisplaySettingsChange }) {
  if (!group) return;

  const modal = ensureChartDisplaySettingsModal();
  const settings = normalizeDisplaySettings(group.displaySettings || {});

  const widthInput = document.getElementById('chart-display-width');
  const heightInput = document.getElementById('chart-display-height');
  const showGridInput = document.getElementById('chart-display-show-grid');
  const showPointsInput = document.getElementById('chart-display-show-points');
  const bgColorInput = document.getElementById('chart-display-bg-color');
  const axisColorInput = document.getElementById('chart-display-axis-color');
  const tickColorInput = document.getElementById('chart-display-tick-color');
  const gridColorInput = document.getElementById('chart-display-grid-color');

  if (widthInput) widthInput.value = String(settings.width);
  if (heightInput) heightInput.value = String(settings.height);
  if (showGridInput) showGridInput.checked = settings.showGrid;
  if (showPointsInput) showPointsInput.checked = settings.showPoints;
  if (bgColorInput) bgColorInput.value = settings.chartBackgroundColor;
  if (axisColorInput) axisColorInput.value = settings.axisColor;
  if (tickColorInput) tickColorInput.value = settings.tickColor;
  if (gridColorInput) gridColorInput.value = settings.gridColor;

  modal._initialSettings = { ...settings };
  modal._workingSettings = { ...settings };
  modal._onPreview = (nextSettings) => {
    if (typeof onGroupDisplaySettingsChange !== 'function') return;
    onGroupDisplaySettingsChange(group.sourceGroupIdx, nextSettings);
  };
  modal._onSave = (nextSettings) => {
    if (typeof onGroupDisplaySettingsChange !== 'function') return;
    onGroupDisplaySettingsChange(group.sourceGroupIdx, nextSettings);
  };

  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
}