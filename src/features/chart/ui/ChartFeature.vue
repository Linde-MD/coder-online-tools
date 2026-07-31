<template>
  <section id="feature-chart" class="feature-panel" :class="{ active }">
    <div id="chart-config-panel" class="chart-config-panel mt-3">
      <div class="chart-config-inner container-xl">
        <section class="curve-data-panel">
          <div class="curve-data-panel-head">
            <h2 class="settings-panel-title">曲线数据</h2>
            <p class="settings-panel-note mb-0">按曲线组管理：组内同图绘制，组间分图绘制。</p>
          </div>

          <div class="curve-data-content">
            <div id="curve-list"></div>
            <div class="d-flex flex-wrap gap-2 mt-3">
              <button id="btn-add-curve-group" class="btn btn-outline-primary" type="button">+ 添加曲线组</button>
              <button id="btn-re-render" class="btn btn-success" type="button">重新生成曲线</button>
            </div>
          </div>
        </section>
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
      <div class="formula-modal-tip">支持 JavaScript 与 DSL 两种编辑语法。组内可用 y1、f1(x)、别名(x) 引用其他曲线值。</div>
      <div class="formula-language-row">
        <label class="form-label mb-0" for="formula-language-select">编辑语法</label>
        <select id="formula-language-select" class="form-select form-select-sm formula-language-select">
          <option value="js">JavaScript</option>
          <option value="dsl">DSL（表达式）</option>
        </select>
        <button id="btn-formula-dsl-help" type="button" class="btn btn-outline-secondary btn-sm">DSL 帮助</button>
      </div>
      <div id="formula-dsl-assist" class="formula-dsl-assist" style="display:none;"></div>
      <div id="formula-dsl-help-panel" class="formula-dsl-help-panel" style="display:none;">
        <div class="formula-dsl-help-head">
          <strong>DSL 语法与函数说明</strong>
          <button id="btn-formula-dsl-help-close" type="button" class="btn btn-outline-secondary btn-sm">关闭</button>
        </div>
        <pre id="formula-dsl-help-text" class="formula-dsl-help-text"></pre>
      </div>
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
defineProps({
  active: {
    type: Boolean,
    default: true,
  },
});
</script>
