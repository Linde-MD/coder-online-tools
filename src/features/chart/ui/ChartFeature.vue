<template>
  <section id="feature-chart" class="feature-panel" :class="{ active }">
    <div id="chart-config-panel" class="chart-config-panel mt-3">
      <div class="chart-config-inner container-xl">
        <div class="settings-panels">
          <SettingsPanel title="画布与显示" note="控制图尺寸、可见元素和整体视觉风格。">
              <div class="settings-subcard">
                <div class="settings-subtitle">尺寸与显示项</div>
                <div class="row g-3 align-items-end">
                  <div class="col-6 col-md-3 col-lg-2">
                    <label for="input-width" class="form-label mb-1">宽度</label>
                    <input id="input-width" type="number" min="200" max="2000" class="form-control form-control-sm" value="800">
                  </div>
                  <div class="col-6 col-md-3 col-lg-2">
                    <label for="input-height" class="form-label mb-1">高度</label>
                    <input id="input-height" type="number" min="200" max="2000" class="form-control form-control-sm" value="800">
                  </div>
                  <div class="col-6 col-md-4 col-lg-2">
                    <div class="form-check form-switch mt-2 settings-display-switch">
                      <input id="input-showMaxGuideLines" class="form-check-input" type="checkbox" checked>
                      <label class="form-check-label" for="input-showMaxGuideLines">显示最大值虚线</label>
                    </div>
                  </div>
                  <div class="col-6 col-md-4 col-lg-2">
                    <div class="form-check form-switch mt-2 settings-display-switch">
                      <input id="input-showGrid" class="form-check-input" type="checkbox" checked>
                      <label class="form-check-label" for="input-showGrid">显示背景网格</label>
                    </div>
                  </div>
                  <div class="col-6 col-md-4 col-lg-2">
                    <div class="form-check form-switch mt-2 settings-display-switch">
                      <input id="input-showPoints" class="form-check-input" type="checkbox" checked>
                      <label class="form-check-label" for="input-showPoints">显示点</label>
                    </div>
                  </div>
                </div>
              </div>

              <div class="settings-subcard mt-3">
                <div class="settings-subtitle">图像配色</div>
                <div class="row g-3 align-items-end">
                  <div class="col-6 col-md-4 col-lg-2">
                    <label for="input-bgcolor" class="form-label mb-1">背景色</label>
                    <input id="input-bgcolor" type="color" class="form-control form-control-color" value="#fffdf9">
                  </div>
                  <div class="col-6 col-md-4 col-lg-2">
                    <label for="input-axis-color" class="form-label mb-1">坐标轴色</label>
                    <input id="input-axis-color" type="color" class="form-control form-control-color" value="#3d3d3a">
                  </div>
                  <div class="col-6 col-md-4 col-lg-2">
                    <label for="input-tick-color" class="form-label mb-1">刻度字色</label>
                    <input id="input-tick-color" type="color" class="form-control form-control-color" value="#6c6a64">
                  </div>
                  <div class="col-6 col-md-4 col-lg-2">
                    <label for="input-grid-color" class="form-label mb-1">网格线色</label>
                    <input id="input-grid-color" type="color" class="form-control form-control-color" value="#d8d0c4">
                  </div>
                  <div class="col-6 col-md-4 col-lg-2">
                    <label for="input-guide-color" class="form-label mb-1">最大值线色</label>
                    <input id="input-guide-color" type="color" class="form-control form-control-color" value="#8e8b82">
                  </div>
                </div>
              </div>
          </SettingsPanel>

          <SettingsPanel title="曲线数据" note="按曲线组管理：组内同图绘制，组间分图绘制。">
              <div id="curve-list"></div>
              <div class="d-flex flex-wrap gap-2 mt-3">
                <button id="btn-add-curve-group" class="btn btn-outline-primary" type="button">+ 添加曲线组</button>
                <button id="btn-re-render" class="btn btn-success" type="button">重新生成曲线</button>
              </div>
          </SettingsPanel>
        </div>
      </div>
    </div>

    <div id="chart-svg-container" class="flex-center mb-200 container-xl">
      <div id="svg-resize-wrapper" class="svg-resize-wrapper">
        <!-- SVG 将由 chart-renderer 动态插入到此容器 -->
      </div>
    </div>
  </section>

  <div id="formula-editor-modal" class="formula-modal" aria-hidden="true">
    <div class="formula-modal-card" role="dialog" aria-modal="true" aria-labelledby="formula-editor-title">
      <div class="formula-modal-title" id="formula-editor-title">函数编辑器（JS 箭头匿名函数）</div>
      <div class="formula-modal-tip">请填写单个箭头函数，例如 (x) =&gt; { return x; }。组内可用 y1、f1(x)、别名(x) 引用其他曲线值。</div>
      <div id="formula-code-editor" class="formula-code-editor"></div>
      <textarea id="textarea-formula-code" class="formula-textarea" style="display:none;"></textarea>
      <div id="formula-editor-error" class="formula-editor-error"></div>
      <div class="formula-modal-actions">
        <button id="btn-formula-cancel" class="btn" type="button">取消</button>
        <button id="btn-formula-save" class="btn btn-success" type="button">保存并应用</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { SettingsPanel } from '@/shared/components';

defineProps({
  active: {
    type: Boolean,
    default: true,
  },
});
</script>
