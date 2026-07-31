<template>
  <section id="feature-wenyan" class="feature-panel" :class="{ active }">
    <div class="wenyan-panel container-xl">
      <div
        ref="wenyanResizeHost"
        class="wenyan-grid wenyan-grid-resizable"
        :class="{ 'is-compact': isCompactLayout }"
        :style="wenyanGridStyle"
      >
        <aside class="wenyan-sidebar-card wenyan-pane-left" :style="wenyanCardStyle">
          <div class="wenyan-sidebar-head">
            <h3 class="wenyan-sidebar-title">脚本列表</h3>
            <button
              type="button"
              class="wenyan-icon-tool-btn"
              title="新建脚本"
              data-tip="新建脚本"
              @click="addScript"
              :disabled="isBusy"
            >
              <span aria-hidden="true">＋</span>
            </button>
          </div>
          <div class="wenyan-script-list">
            <button
              v-for="item in scripts"
              :key="item.id"
              type="button"
              class="wenyan-script-item"
              :class="{ active: item.id === activeScriptId }"
              @click="selectScript(item.id)"
            >
              <span class="wenyan-script-name">{{ item.title }}</span>
              <span v-if="item.isBuiltin" class="wenyan-script-tag">示例</span>
            </button>
          </div>
          <div class="wenyan-sidebar-foot">
            <button
              type="button"
              class="wenyan-tab-btn danger"
              @click="removeActiveScript"
              :disabled="isBusy || currentScript?.isBuiltin || scripts.length <= 1"
            >
              删除当前脚本
            </button>
          </div>
        </aside>

        <div
          v-if="!isCompactLayout"
          class="wenyan-splitter wenyan-splitter-v wenyan-splitter-left"
          role="separator"
          aria-orientation="vertical"
          @pointerdown="startHorizontalResize('left-mid', $event)"
        ></div>

        <div class="wenyan-editor-card wenyan-pane-middle" :style="wenyanCardStyle">
          <div class="wenyan-card-head">
            <div>
              <h2 class="wenyan-title">文言编程</h2>
              <input
                v-model="currentScriptTitle"
                class="form-control form-control-sm wenyan-script-title-input mt-2"
                maxlength="40"
                placeholder="脚本名称"
              >
            </div>
            <div class="wenyan-actions">
              <div class="wenyan-toolbar" role="toolbar" aria-label="文言工具栏">
                <button type="button" class="wenyan-icon-tool-btn" title="语法帮助" data-tip="语法帮助" @click="openHelpModal" :disabled="isBusy">
                  <span aria-hidden="true">？</span>
                </button>
                <button type="button" class="wenyan-icon-tool-btn" title="编译 JS/Python" data-tip="编译" @click="compileAll" :disabled="isBusy">
                  <span aria-hidden="true">⚙</span>
                </button>
                <button type="button" class="wenyan-icon-tool-btn accent" title="运行" data-tip="运行" @click="runProgram" :disabled="isBusy">
                  <span aria-hidden="true">▶</span>
                </button>
                <button type="button" class="wenyan-icon-tool-btn" title="渲染古书" data-tip="渲染古书" @click="renderBookPages" :disabled="isBusy">
                  <span aria-hidden="true">卷</span>
                </button>
                <button type="button" class="wenyan-icon-tool-btn" title="还原当前脚本" data-tip="还原" @click="restoreCurrentScript" :disabled="isBusy">
                  <span aria-hidden="true">↺</span>
                </button>
              </div>
            </div>
          </div>

          <div class="wenyan-monaco-shell">
            <div ref="monacoEditorHost" class="wenyan-monaco-host" aria-label="文言代码编辑器"></div>
          </div>
          <div class="wenyan-inline-tools">
            <label class="form-check-label d-inline-flex align-items-center gap-2">
              <input v-model="renderWithResult" class="form-check-input" type="checkbox">
              渲染古书时附带运行结果
            </label>
            <span class="wenyan-runtime" :class="{ 'is-error': runtimeStatusLevel === 'error' }">{{ runtimeStatus }}</span>
          </div>
        </div>

        <div
          v-if="!isCompactLayout"
          class="wenyan-splitter wenyan-splitter-v wenyan-splitter-right"
          role="separator"
          aria-orientation="vertical"
          @pointerdown="startHorizontalResize('mid-right', $event)"
        ></div>

        <div class="wenyan-result-card wenyan-pane-right" :style="wenyanCardStyle">
          <div class="wenyan-result-tabs">
            <button
              type="button"
              class="wenyan-tab-btn"
              :class="{ active: activeTab === 'js' }"
              @click="activeTab = 'js'"
            >
              JavaScript
            </button>
            <button
              type="button"
              class="wenyan-tab-btn"
              :class="{ active: activeTab === 'py' }"
              @click="activeTab = 'py'"
            >
              Python
            </button>
            <button
              type="button"
              class="wenyan-tab-btn"
              :class="{ active: activeTab === 'run' }"
              @click="activeTab = 'run'"
            >
              运行输出
            </button>
            <button
              type="button"
              class="wenyan-tab-btn"
              :class="{ active: activeTab === 'render' }"
              @click="activeTab = 'render'"
            >
              古书渲染
            </button>
          </div>

          <pre v-if="activeTab === 'js'" class="wenyan-code-output">{{ jsOutput }}</pre>
          <pre v-else-if="activeTab === 'py'" class="wenyan-code-output">{{ pyOutput }}</pre>
          <pre v-else-if="activeTab === 'run'" class="wenyan-code-output">{{ runOutput }}</pre>
          <div v-else class="wenyan-render-output">
            <div v-if="renderPages.length === 0" class="wenyan-empty">尚未生成古书渲染，点击“渲染古书”。</div>
            <template v-else>
              <div class="wenyan-render-actions">
                <button type="button" class="wenyan-tab-btn" @click="openRenderModal">弹窗查看（可放大/下载/复制）</button>
              </div>
              <div class="wenyan-render-page" v-html="renderPages[0]"></div>
            </template>
          </div>
        </div>
      </div>

      <div
        v-if="!isCompactLayout"
        class="wenyan-splitter-h"
        role="separator"
        aria-orientation="horizontal"
        @pointerdown="startVerticalResize"
      ></div>

      <div class="wenyan-render-modal" :class="{ open: renderModalOpen }" @click.self="closeRenderModal">
        <div class="wenyan-render-modal-card" role="dialog" aria-modal="true" aria-label="古书渲染预览">
          <div class="wenyan-render-modal-head">
            <strong>古书渲染预览</strong>
            <div class="wenyan-render-modal-tools">
              <button type="button" class="btn btn-outline-secondary btn-sm" @click="zoomOut">-</button>
              <span class="wenyan-zoom-text">{{ Math.round(renderZoom * 100) }}%</span>
              <button type="button" class="btn btn-outline-secondary btn-sm" @click="zoomIn">+</button>
              <button type="button" class="btn btn-outline-primary btn-sm" @click="downloadCurrentRenderSvg" :disabled="!currentRenderSvg">下载SVG</button>
              <button type="button" class="btn btn-outline-primary btn-sm" @click="copyCurrentRenderSvg" :disabled="!currentRenderSvg">复制SVG</button>
              <button type="button" class="btn btn-outline-secondary btn-sm" @click="closeRenderModal">关闭</button>
            </div>
          </div>

          <div class="wenyan-render-modal-body">
            <div class="wenyan-render-modal-pagebar">
              <button type="button" class="btn btn-outline-secondary btn-sm" @click="prevRenderPage" :disabled="renderPageIndex <= 0">上一页</button>
              <span>第 {{ renderPages.length === 0 ? 0 : renderPageIndex + 1 }} / {{ renderPages.length }} 页</span>
              <button type="button" class="btn btn-outline-secondary btn-sm" @click="nextRenderPage" :disabled="renderPageIndex >= renderPages.length - 1">下一页</button>
              <span class="wenyan-copy-status">{{ copyStatus }}</span>
            </div>

            <div class="wenyan-render-canvas-wrap">
              <div class="wenyan-render-canvas" :style="{ transform: `scale(${renderZoom})` }" v-html="currentRenderSvg"></div>
            </div>
          </div>
        </div>
      </div>

      <div class="wenyan-help-modal" :class="{ open: helpModalOpen }" @click.self="closeHelpModal">
        <div class="wenyan-help-modal-card" role="dialog" aria-modal="true" aria-label="文言语法帮助">
          <div class="wenyan-help-modal-head">
            <strong>文言语法帮助</strong>
            <button type="button" class="btn btn-outline-secondary btn-sm" @click="closeHelpModal">关闭</button>
          </div>
          <div class="wenyan-help-modal-body">
            <article class="wenyan-help-doc" v-html="renderedHelpHtml"></article>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import * as monaco from 'monaco-editor/editor/editor.api';
import editorWorker from 'monaco-editor/editor/editor.worker?worker';
import { marked } from 'marked';
import wenyanSyntaxHelpMarkdown from '../docs/wenyan-syntax-help.md?raw';

defineProps({
  active: {
    type: Boolean,
    default: false,
  },
});

const SAMPLE_HELLO_CODE = `吾有一數。曰三。名之曰「甲」。
為是「甲」遍。
  吾有一言。曰「「問天地好在。」」。書之。
云云。`;

const SAMPLE_HANOI_CODE = `吾有一術。名之曰「漢諾塔」。欲行是術。必先得四數。曰「盤數」。曰「甲塔」。曰「乙塔」。曰「丙塔」。
乃行是術曰。
  若「盤數」等於零者。吾有一列。乃得其也。
  減「盤數」以一。昔之「盤數」者。今其是矣。
  施「漢諾塔」於「盤數」。於「甲塔」。於「丙塔」。於「乙塔」。名之曰「古」。
  施「漢諾塔」於「盤數」。於「丙塔」。於「乙塔」。於「甲塔」。名之曰「後」。
  吾有一列。名之曰「步」。充「步」以「甲塔」。以「乙塔」。
  吾有一列。名之曰「今」。充「今」以「步」。
  銜「古」以「今」以「後」。名之曰「史」。乃得「史」。
是謂「漢諾塔」之術也。

吾有一術。名之曰「畫塔法」。欲行是術。必先得一數。曰「盤數」。一列。曰「史」。
乃行是術曰。
  吾有一言。曰「「甲乙丙」」。名之曰「諸名」。
  吾有一列。名之曰「三塔」。充「三塔」以「盤數」。以零。以零。

  吾有一術。名之曰「畫」。是術曰。
    有數一。名之曰「戌」。恆為是。若「戌」大於三者乃止也。
      夫「三塔」之「戌」。名之曰「碟」。
      減「盤數」以「碟」。名之曰「柱」。
      吾有一言。名之曰「行」。
      為是「碟」遍。加「行」以「「盤」」。昔之「行」者。今其是矣。云云。
      為是「柱」遍。加「行」以「「一」」。昔之「行」者。今其是矣。云云。
      夫「諸名」之「戌」。名之曰「名」。
      吾有四言。曰「「〔」」。曰「名」。曰「「〕」」。曰「行」。書之。
    加一以「戌」。昔之「戌」者。今其是矣云云。
    書之。
  是謂「畫」之術也。

  凡「史」中之「步」
    施「畫」噫。
    夫「步」之一。名之曰「起」
    夫「步」之二。名之曰「訖」
    夫「三塔」之「起」。減其以一。昔之「三塔」之「起」者。今其是矣。
    夫「三塔」之「訖」。加其以一。昔之「三塔」之「訖」者。今其是矣。
    書之。
  云云。
  施「畫」噫。
  吾有一言。曰「「畢」」。書之。
是謂「畫塔法」之術也。

有數四。名之曰「盤數」
施「漢諾塔」於「盤數」。於一。於二。於三。名之曰「史」。
施「畫塔法」於「盤數」。於「史」。`;

const SAMPLE_BEER99_CODE = `吾有一言。曰「「九十九杯啤酒。」」。書之。
有數九十九。名之曰「酒數」。

恆為是。若「酒數」等於零者乃止也。

  吾有三言。曰「「牆上還有」」。曰「酒數」。
    曰「「杯啤酒。且飲且歌。」」。書之。

減「酒數」以一。昔之「酒數」者。今其是矣云云。

吾有一言。曰「「杯盡興未盡。」」。書之。`;

const SAMPLE_HV_WORKFLOW_CODE = `吾有一言。曰「「訊號約定：大於零視為是，零或小於零視為否。」」。書之。

吾有一術。名之曰「高壓上電判定」。欲行是術。必先得四數。曰「鑰匙信號」。曰「充電槍接入」。曰「系統故障計數」。曰「接觸器閉合反饋」。
乃行是術曰。
  加「鑰匙信號」以「充電槍接入」。名之曰「高壓使能請求」。
  減「高壓使能請求」以「系統故障計數」。名之曰「允許閉合接觸器」。
  乘「允許閉合接觸器」以「接觸器閉合反饋」。名之曰「高壓已上完成」。

  吾有一列。名之曰「狀態」。
  充「狀態」以「高壓使能請求」。以「允許閉合接觸器」。以「高壓已上完成」。
  乃得「狀態」。
是謂「高壓上電判定」之術也。

吾有一言。曰「「工況一：鑰匙開、無故障、反饋已閉合」」。書之。
施「高壓上電判定」於一。於零。於零。於一。名之曰「狀態甲」。
夫「狀態甲」。書之。
書之。

吾有一言。曰「「工況二：鑰匙開、有故障」」。書之。
施「高壓上電判定」於一。於零。於二。於零。名之曰「狀態乙」。
夫「狀態乙」。書之。
書之。

吾有一言。曰「「工況三：充電槍接入、等待接觸器反饋」」。書之。
施「高壓上電判定」於零。於一。於零。於零。名之曰「狀態丙」。
夫「狀態丙」。書之。
書之。

吾有一言。曰「「工況四：無使能請求、應下高壓」」。書之。
施「高壓上電判定」於零。於零。於零。於零。名之曰「狀態丁」。
夫「狀態丁」。書之。`;

const SCRIPT_STORAGE_KEY = 'coderOnlineTools.wenyanScripts.v1';
const BUILTIN_SCRIPTS = [
  {
    id: 'sample-hello',
    title: '问天地好在',
    source: SAMPLE_HELLO_CODE,
    isBuiltin: true,
  },
  {
    id: 'sample-hanoi',
    title: '汉诺塔',
    source: SAMPLE_HANOI_CODE,
    isBuiltin: true,
  },
  {
    id: 'sample-beer99',
    title: '九十九杯啤酒',
    source: SAMPLE_BEER99_CODE,
    isBuiltin: true,
  },
  {
    id: 'sample-hv-workflow',
    title: 'VCU上高压流程',
    source: SAMPLE_HV_WORKFLOW_CODE,
    isBuiltin: true,
  },
];

const scripts = ref([]);
const activeScriptId = ref('');
const sourceCode = ref('');
const monacoEditorHost = ref(null);
const wenyanResizeHost = ref(null);
const jsOutput = ref('// 点击“编译 JS/Python”以生成 JavaScript');
const pyOutput = ref('# 点击“编译 JS/Python”以生成 Python');
const runOutput = ref('');
const renderPages = ref([]);
const activeTab = ref('js');
const renderWithResult = ref(false);
const runtimeStatus = ref('正在加载 Wenyan 运行时...');
const runtimeStatusLevel = ref('normal');
const isBusy = ref(false);
const renderModalOpen = ref(false);
const helpModalOpen = ref(false);
const renderZoom = ref(1.3);
const renderPageIndex = ref(0);
const copyStatus = ref('');
const paneRatios = ref([0.2, 0.42, 0.38]);
const cardHeight = ref(560);
const hostWidth = ref(0);
const isCompactLayout = ref(false);

let wenyanCore = null;
let wenyanRender = null;
let monacoEditor = null;
let applyingEditorContent = false;
let resizeObserver = null;
let dragState = null;

const SPLITTER_WIDTH = 10;
const MIN_PANE_WIDTH = 220;
const MIN_CARD_HEIGHT = 360;
const MAX_CARD_HEIGHT = 920;

const currentScript = computed(() => scripts.value.find(item => item.id === activeScriptId.value) || null);
const currentScriptTitle = computed({
  get() {
    return currentScript.value?.title || '';
  },
  set(nextTitle) {
    if (!currentScript.value) return;
    const safeTitle = String(nextTitle || '').trim() || '未命名脚本';
    currentScript.value.title = safeTitle;
    persistScripts();
  },
});
const currentRenderSvg = computed(() => renderPages.value[renderPageIndex.value] || '');
const paneWidths = computed(() => {
  const total = Math.max(hostWidth.value - SPLITTER_WIDTH * 2, 0);
  const first = Math.round(total * paneRatios.value[0]);
  const second = Math.round(total * paneRatios.value[1]);
  const third = Math.max(total - first - second, 0);
  return [first, second, third];
});
const wenyanGridStyle = computed(() => {
  if (isCompactLayout.value) {
    return {};
  }

  const [left, middle, right] = paneWidths.value;
  return {
    gridTemplateColumns: `${left}px ${SPLITTER_WIDTH}px ${middle}px ${SPLITTER_WIDTH}px ${right}px`,
  };
});
const wenyanCardStyle = computed(() => {
  if (isCompactLayout.value) return null;
  return {
    height: `${cardHeight.value}px`,
  };
});
const renderedHelpHtml = computed(() => marked.parse(wenyanSyntaxHelpMarkdown, {
  async: false,
  gfm: true,
  breaks: true,
}));

function createDefaultScripts() {
  return BUILTIN_SCRIPTS.map(item => ({ ...item }));
}

function hydrateScripts(rawScripts = []) {
  const list = Array.isArray(rawScripts) ? rawScripts : [];
  const normalized = list
    .map((item, idx) => ({
      id: String(item?.id || `script-${Date.now()}-${idx}`),
      title: String(item?.title || `脚本 ${idx + 1}`),
      source: String(item?.source || ''),
      isBuiltin: Boolean(item?.isBuiltin),
    }))
    .filter(item => item.id);

  BUILTIN_SCRIPTS.forEach((builtin) => {
    const existing = normalized.find(item => item.id === builtin.id);
    if (existing) {
      existing.title = builtin.title;
      existing.source = builtin.source;
      existing.isBuiltin = true;
    } else {
      normalized.push({ ...builtin });
    }
  });

  return normalized.length > 0 ? normalized : createDefaultScripts();
}

function readPersistedScripts() {
  try {
    const raw = localStorage.getItem(SCRIPT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (_) {
    return null;
  }
}

function persistScripts() {
  try {
    const payload = {
      activeScriptId: activeScriptId.value,
      scripts: scripts.value.map(item => ({
        id: item.id,
        title: item.title,
        source: item.source,
        isBuiltin: item.isBuiltin,
      })),
    };
    localStorage.setItem(SCRIPT_STORAGE_KEY, JSON.stringify(payload));
  } catch (_) {
    // Ignore storage failures.
  }
}

function initializeScripts() {
  const persisted = readPersistedScripts();
  const hydrated = hydrateScripts(persisted?.scripts || createDefaultScripts());
  scripts.value = hydrated;

  const targetId = String(persisted?.activeScriptId || hydrated[0]?.id || '');
  activeScriptId.value = hydrated.some(item => item.id === targetId) ? targetId : hydrated[0].id;
  sourceCode.value = currentScript.value?.source || '';
}

function selectScript(scriptId) {
  if (!scripts.value.some(item => item.id === scriptId)) return;
  activeScriptId.value = scriptId;
  sourceCode.value = currentScript.value?.source || '';
  persistScripts();
}

function addScript() {
  const nextScript = {
    id: `user-${Date.now()}`,
    title: `新脚本 ${scripts.value.filter(item => !item.isBuiltin).length + 1}`,
    source: '',
    isBuiltin: false,
  };
  scripts.value.push(nextScript);
  activeScriptId.value = nextScript.id;
  sourceCode.value = '';
  persistScripts();
}

function removeActiveScript() {
  const active = currentScript.value;
  if (!active || active.isBuiltin || scripts.value.length <= 1) return;

  const idx = scripts.value.findIndex(item => item.id === active.id);
  if (idx < 0) return;

  scripts.value.splice(idx, 1);
  const fallback = scripts.value[Math.max(0, idx - 1)] || scripts.value[0] || null;
  activeScriptId.value = fallback?.id || '';
  sourceCode.value = fallback?.source || '';
  persistScripts();
}

function restoreCurrentScript() {
  const active = currentScript.value;
  if (!active) return;

  const builtin = BUILTIN_SCRIPTS.find(item => item.id === active.id);
  active.source = builtin ? builtin.source : '';
  sourceCode.value = active.source;
  runtimeStatus.value = '已还原当前脚本。';
  runtimeStatusLevel.value = 'normal';
  persistScripts();
}

watch(sourceCode, (value) => {
  if (!currentScript.value) return;
  currentScript.value.source = String(value || '');
  persistScripts();

  if (!monacoEditor) return;
  const nextValue = String(value || '');
  if (monacoEditor.getValue() === nextValue) return;

  applyingEditorContent = true;
  monacoEditor.setValue(nextValue);
  applyingEditorContent = false;
});

function initializeMonacoTheme() {
  monaco.editor.defineTheme('wenyan-warm', {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '7A7269' },
      { token: 'string', foreground: '7F4B34' },
    ],
    colors: {
      'editor.background': '#FFF9F2',
      'editor.foreground': '#2F2924',
      'editorLineNumber.foreground': '#A08975',
      'editorLineNumber.activeForeground': '#6D5A4A',
      'editorCursor.foreground': '#A9583E',
      'editor.selectionBackground': '#EFD8C8',
      'editor.inactiveSelectionBackground': '#F5E8DE',
      'editorIndentGuide.background1': '#E8DCCF',
      'editorIndentGuide.activeBackground1': '#D3B7A2',
      'editorGutter.background': '#FFF9F2',
    },
  });
}

function initializeMonacoEditor() {
  if (!monacoEditorHost.value || monacoEditor) return;

  const root = globalThis;
  if (!root.MonacoEnvironment) {
    root.MonacoEnvironment = {};
  }

  root.MonacoEnvironment.getWorker = () => new editorWorker();

  initializeMonacoTheme();
  monacoEditor = monaco.editor.create(monacoEditorHost.value, {
    value: sourceCode.value,
    language: 'plaintext',
    theme: 'wenyan-warm',
    automaticLayout: true,
    minimap: { enabled: false },
    wordWrap: 'on',
    lineNumbers: 'on',
    roundedSelection: false,
    scrollBeyondLastLine: false,
    fontFamily: 'JetBrains Mono, Consolas, monospace',
    fontSize: 14,
    lineHeight: 23,
    tabSize: 2,
    insertSpaces: true,
  });

  monacoEditor.onDidChangeModelContent(() => {
    if (applyingEditorContent) return;
    sourceCode.value = monacoEditor.getValue();
  });
}

function recalcLayout() {
  const width = Number(wenyanResizeHost.value?.clientWidth || 0);
  hostWidth.value = width;
  isCompactLayout.value = width < 900;

  if (isCompactLayout.value) {
    return;
  }

  const total = Math.max(width - SPLITTER_WIDTH * 2, 0);
  if (total <= 0) return;

  const current = paneWidths.value;
  if (current.some(value => value < MIN_PANE_WIDTH)) {
    const equal = total / 3;
    paneRatios.value = [equal / total, equal / total, equal / total];
  }
}

function initializeResizeObserver() {
  if (!wenyanResizeHost.value || typeof ResizeObserver !== 'function') return;

  resizeObserver = new ResizeObserver(() => {
    recalcLayout();
  });
  resizeObserver.observe(wenyanResizeHost.value);
  recalcLayout();
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function startHorizontalResize(edge, event) {
  if (isCompactLayout.value) return;
  event.preventDefault();

  const startWidths = [...paneWidths.value];
  const total = startWidths[0] + startWidths[1] + startWidths[2];
  dragState = {
    type: 'horizontal',
    edge,
    startX: event.clientX,
    startWidths,
    total,
  };

  window.addEventListener('pointermove', handleDragMove);
  window.addEventListener('pointerup', stopDrag);
}

function startVerticalResize(event) {
  if (isCompactLayout.value) return;
  event.preventDefault();

  dragState = {
    type: 'vertical',
    startY: event.clientY,
    startHeight: cardHeight.value,
  };

  window.addEventListener('pointermove', handleDragMove);
  window.addEventListener('pointerup', stopDrag);
}

function handleDragMove(event) {
  if (!dragState) return;

  if (dragState.type === 'horizontal') {
    const delta = event.clientX - dragState.startX;
    const [s0, s1, s2] = dragState.startWidths;
    let next = [s0, s1, s2];

    if (dragState.edge === 'left-mid') {
      const pair = s0 + s1;
      const nextLeft = clamp(s0 + delta, MIN_PANE_WIDTH, pair - MIN_PANE_WIDTH);
      const nextMid = pair - nextLeft;
      next = [nextLeft, nextMid, s2];
    } else {
      const pair = s1 + s2;
      const nextMid = clamp(s1 + delta, MIN_PANE_WIDTH, pair - MIN_PANE_WIDTH);
      const nextRight = pair - nextMid;
      next = [s0, nextMid, nextRight];
    }

    const total = dragState.total || 1;
    paneRatios.value = [next[0] / total, next[1] / total, next[2] / total];
    return;
  }

  const deltaY = event.clientY - dragState.startY;
  cardHeight.value = clamp(dragState.startHeight + deltaY, MIN_CARD_HEIGHT, MAX_CARD_HEIGHT);
}

function stopDrag() {
  dragState = null;
  window.removeEventListener('pointermove', handleDragMove);
  window.removeEventListener('pointerup', stopDrag);
}

function disposeMonacoEditor() {
  if (!monacoEditor) return;
  monacoEditor.dispose();
  monacoEditor = null;
}

function normalizeBasePath(base) {
  const value = String(base || '/').trim() || '/';
  if (value.endsWith('/')) return value;
  return `${value}/`;
}

function resolveCoreApi() {
  const root = globalThis;
  if (root?.Wenyan && typeof root.Wenyan.compile === 'function') return root.Wenyan;
  if (root?.exports?.Wenyan && typeof root.exports.Wenyan.compile === 'function') return root.exports.Wenyan;
  if (root?.exports && typeof root.exports.compile === 'function') return root.exports;
  if (root?.module?.exports && typeof root.module.exports.compile === 'function') return root.module.exports;
  return null;
}

function resolveRenderApi(coreApi) {
  const root = globalThis;

  if (coreApi?.render && typeof coreApi.render.render === 'function') return coreApi.render;
  if (root?.Wenyan?.render && typeof root.Wenyan.render.render === 'function') return root.Wenyan.render;
  if (root?.exports?.render && typeof root.exports.render === 'function') return root.exports;
  if (root?.module?.exports?.render && typeof root.module.exports.render === 'function') return root.module.exports;
  return null;
}

async function assertAssetReachable(url) {
  const response = await fetch(url, { method: 'GET', cache: 'no-cache' });
  if (!response.ok) {
    throw new Error(`资源不可访问：${url}`);
  }
}

function loadScriptOnce(scriptId, src, options = {}) {
  const { maskAmd = false } = options;

  return new Promise((resolve, reject) => {
    const existing = document.getElementById(scriptId);
    if (existing) {
      if (existing.getAttribute('data-loaded') === 'true') {
        resolve();
        return;
      }

      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error(`脚本加载失败：${src}`)), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = src;
    script.async = false;

    const root = globalThis;
    const shouldMaskAmd = Boolean(maskAmd && root && typeof root.define === 'function' && root.define.amd);
    const previousDefine = shouldMaskAmd ? root.define : null;
    if (shouldMaskAmd) {
      root.define = undefined;
    }

    function restoreAmdDefine() {
      if (shouldMaskAmd) {
        root.define = previousDefine;
      }
    }

    script.addEventListener('load', () => {
      restoreAmdDefine();
      script.setAttribute('data-loaded', 'true');
      resolve();
    }, { once: true });
    script.addEventListener('error', () => {
      restoreAmdDefine();
      reject(new Error(`脚本加载失败：${src}`));
    }, { once: true });
    document.head.appendChild(script);
  });
}

function removeScriptById(scriptId) {
  const existing = document.getElementById(scriptId);
  if (existing) {
    existing.remove();
  }
}

function extractPythonBody(compiledText) {
  if (typeof compiledText !== 'string') return '';
  const parts = compiledText.split('#####\n');
  return parts.length > 1 ? parts.slice(1).join('#####\n').trim() : compiledText.trim();
}

function formatJavaScriptSource(rawCode) {
  const source = String(rawCode || '');
  if (!source.trim()) return '';

  const indentUnit = '  ';
  let result = '';
  let indent = 0;
  let inString = false;
  let stringChar = '';
  let escaped = false;
  let inLineComment = false;
  let inBlockComment = false;
  let parenDepth = 0;
  let needIndent = true;

  function writeIndent() {
    if (!needIndent) return;
    result += indentUnit.repeat(Math.max(indent, 0));
    needIndent = false;
  }

  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    const next = source[i + 1] || '';

    if (inLineComment) {
      writeIndent();
      result += ch;
      if (ch === '\n') {
        inLineComment = false;
        needIndent = true;
      }
      continue;
    }

    if (inBlockComment) {
      writeIndent();
      result += ch;
      if (ch === '*' && next === '/') {
        result += '/';
        i += 1;
        inBlockComment = false;
      }
      continue;
    }

    if (inString) {
      writeIndent();
      result += ch;
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === stringChar) {
        inString = false;
        stringChar = '';
      }
      continue;
    }

    if (ch === '/' && next === '/') {
      writeIndent();
      result += '//';
      i += 1;
      inLineComment = true;
      continue;
    }

    if (ch === '/' && next === '*') {
      writeIndent();
      result += '/*';
      i += 1;
      inBlockComment = true;
      continue;
    }

    if (ch === '"' || ch === '\'' || ch === '`') {
      writeIndent();
      result += ch;
      inString = true;
      stringChar = ch;
      continue;
    }

    if (ch === '(') {
      writeIndent();
      parenDepth += 1;
      result += ch;
      continue;
    }

    if (ch === ')') {
      writeIndent();
      parenDepth = Math.max(parenDepth - 1, 0);
      result += ch;
      continue;
    }

    if (ch === '{') {
      writeIndent();
      result += '{\n';
      indent += 1;
      needIndent = true;
      continue;
    }

    if (ch === '}') {
      indent = Math.max(indent - 1, 0);
      result = result.replace(/[ \t]*$/g, '');
      if (!result.endsWith('\n')) {
        result += '\n';
      }
      result += `${indentUnit.repeat(indent)}}`;
      needIndent = false;
      continue;
    }

    if (ch === ';') {
      writeIndent();
      result += ';';
      if (parenDepth === 0) {
        result += '\n';
        needIndent = true;
      }
      continue;
    }

    if (ch === '\n' || ch === '\r') {
      continue;
    }

    if (/\s/.test(ch)) {
      if (!needIndent && !result.endsWith(' ') && !result.endsWith('\n')) {
        result += ' ';
      }
      continue;
    }

    writeIndent();
    result += ch;
  }

  return result
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

function getCompileOptions(lang, errorSink) {
  return {
    lang,
    romanizeIdentifiers: 'none',
    errorCallback: (message) => {
      if (typeof errorSink === 'function') {
        errorSink(String(message || '编译失败'));
      }
    },
  };
}

async function ensureRuntime() {
  if (wenyanCore && wenyanRender) return;

  const base = normalizeBasePath(import.meta.env.BASE_URL || '/');
  const coreSrc = `${base}vendor/wenyan/core.min.js`;
  const renderSrc = `${base}vendor/wenyan/render.min.js`;

  await assertAssetReachable(coreSrc);
  await assertAssetReachable(renderSrc);

  removeScriptById('wenyan-core-runtime');
  removeScriptById('wenyan-render-runtime');
  await loadScriptOnce('wenyan-core-runtime', coreSrc, { maskAmd: true });
  const coreApi = resolveCoreApi();
  if (!coreApi) {
    throw new Error('Wenyan 编译器未正确加载。');
  }

  await loadScriptOnce('wenyan-render-runtime', renderSrc, { maskAmd: true });
  const renderApi = resolveRenderApi(coreApi);
  if (!renderApi) {
    throw new Error('Wenyan 古书渲染器未正确加载。');
  }

  if (!coreApi.render) {
    coreApi.render = renderApi;
  }

  wenyanCore = coreApi;
  wenyanRender = renderApi;
}

async function compileAll() {
  isBusy.value = true;
  runtimeStatus.value = '正在编译...';
  runtimeStatusLevel.value = 'normal';

  try {
    await ensureRuntime();

    let compileError = '';
    const compiledJs = wenyanCore.compile(
      sourceCode.value,
      getCompileOptions('js', (msg) => {
        compileError = msg;
      }),
    );

    if (compileError) {
      throw new Error(compileError);
    }

    const compiledPyRaw = wenyanCore.compile(
      sourceCode.value,
      getCompileOptions('py', () => {
        // Python 仅用于转译输出，错误最终由 JS 编译主链路与异常处理统一反馈。
      }),
    );

    jsOutput.value = formatJavaScriptSource(compiledJs || '');
    pyOutput.value = extractPythonBody(compiledPyRaw);
    runtimeStatus.value = '编译完成。';
    activeTab.value = 'js';
  } catch (error) {
    runtimeStatus.value = `编译失败：${error?.message || '未知错误'}`;
    runtimeStatusLevel.value = 'error';
  } finally {
    isBusy.value = false;
  }
}

async function runProgram() {
  isBusy.value = true;
  runtimeStatus.value = '正在运行...';
  runtimeStatusLevel.value = 'normal';

  try {
    await ensureRuntime();

    let compileError = '';
    const compiledJs = wenyanCore.compile(
      sourceCode.value,
      getCompileOptions('js', (msg) => {
        compileError = msg;
      }),
    );

    if (compileError) {
      throw new Error(compileError);
    }

    const outputLines = [];
    wenyanCore.evalCompiled(compiledJs, {
      lang: 'js',
      scoped: true,
      outputHanzi: true,
      output: (...args) => {
        outputLines.push(args.join(' '));
      },
    });

    jsOutput.value = formatJavaScriptSource(compiledJs || '');
    runOutput.value = outputLines.join('\n') || '(无输出)';
    runtimeStatus.value = '运行完成。';
    activeTab.value = 'run';
  } catch (error) {
    runOutput.value = `运行失败：${error?.message || '未知错误'}`;
    runtimeStatus.value = '运行失败，请检查代码语法。';
    runtimeStatusLevel.value = 'error';
    activeTab.value = 'run';
  } finally {
    isBusy.value = false;
  }
}

async function renderBookPages() {
  isBusy.value = true;
  runtimeStatus.value = '正在渲染古书页面...';
  runtimeStatusLevel.value = 'normal';

  try {
    await ensureRuntime();

    const pages = wenyanRender.render('文言稿', sourceCode.value, {
      plotResult: renderWithResult.value,
    });

    renderPages.value = Array.isArray(pages) ? pages : [];
    renderPageIndex.value = 0;
    renderModalOpen.value = renderPages.value.length > 0;
    runtimeStatus.value = `古书渲染完成，共 ${renderPages.value.length} 页。`;
    activeTab.value = 'render';
  } catch (error) {
    runtimeStatus.value = `古书渲染失败：${error?.message || '未知错误'}`;
    runtimeStatusLevel.value = 'error';
  } finally {
    isBusy.value = false;
  }
}

function openRenderModal() {
  if (renderPages.value.length === 0) return;
  renderModalOpen.value = true;
}

function closeRenderModal() {
  renderModalOpen.value = false;
}

function openHelpModal() {
  helpModalOpen.value = true;
}

function closeHelpModal() {
  helpModalOpen.value = false;
}

function handleDocumentKeydown(event) {
  if (event.key !== 'Escape') return;
  if (renderModalOpen.value) {
    closeRenderModal();
    return;
  }
  if (helpModalOpen.value) {
    closeHelpModal();
  }
}

function zoomIn() {
  renderZoom.value = Math.min(2.8, Number((renderZoom.value + 0.1).toFixed(2)));
}

function zoomOut() {
  renderZoom.value = Math.max(0.6, Number((renderZoom.value - 0.1).toFixed(2)));
}

function prevRenderPage() {
  if (renderPageIndex.value <= 0) return;
  renderPageIndex.value -= 1;
}

function nextRenderPage() {
  if (renderPageIndex.value >= renderPages.value.length - 1) return;
  renderPageIndex.value += 1;
}

function downloadCurrentRenderSvg() {
  const svgText = currentRenderSvg.value;
  if (!svgText) return;

  const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const pageNo = renderPageIndex.value + 1;
  const safeName = (currentScript.value?.title || 'wenyan').replace(/[\\/:*?"<>|]/g, '_');
  link.href = url;
  link.download = `${safeName}-古书第${pageNo}页.svg`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function copyCurrentRenderSvg() {
  const svgText = currentRenderSvg.value;
  if (!svgText) return;

  try {
    await navigator.clipboard.writeText(svgText);
    copyStatus.value = 'SVG 已复制';
  } catch (_) {
    copyStatus.value = '复制失败';
  }

  window.setTimeout(() => {
    copyStatus.value = '';
  }, 1800);
}

onMounted(async () => {
  initializeScripts();
  await nextTick();
  initializeResizeObserver();
  initializeMonacoEditor();
  window.addEventListener('keydown', handleDocumentKeydown);

  try {
    await ensureRuntime();
    runtimeStatus.value = 'Wenyan 运行时已就绪。';
    await compileAll();
  } catch (error) {
    runtimeStatus.value = `运行时加载失败：${error?.message || '未知错误'}`;
    runtimeStatusLevel.value = 'error';
  }
});

onBeforeUnmount(() => {
  stopDrag();
  window.removeEventListener('keydown', handleDocumentKeydown);
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
  disposeMonacoEditor();
});
</script>
