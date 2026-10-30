<template>
  <section ref="editorSection" class="property-text-editor" :class="{ 'is-expanded': fillHeight }" :aria-label="`${label} 文本编辑`">
    <label v-if="!fillHeight" :for="id" class="property-text-label">{{ label }} {{ formatLabel }}</label>
    <div ref="editorHost" :id="`${id}-editor`" class="property-text-editor-host" :class="{ 'has-errors': errors.length > 0 }">
      <div
        ref="monacoHost" class="property-text-monaco" :aria-label="`${label} 属性 ${formatLabel}`"
        :aria-invalid="errors.length > 0" :aria-describedby="errors.length ? `${id}-errors` : undefined"
      ></div>
      <div v-if="loadingEditor" class="property-text-loading" role="status">正在加载代码编辑器…</div>
      <div v-if="loadError" class="property-text-load-error" role="alert">
        <span>{{ loadError }}</span>
        <button type="button" class="property-text-retry" @click="loadEditor">重试</button>
        <textarea v-model="draft.text" class="form-control property-text-fallback" :aria-label="`${label} 属性文本`"></textarea>
      </div>
    </div>
    <div
      v-if="fillHeight && errors.length" ref="errorSplitter" class="property-text-splitter" role="separator"
      aria-orientation="horizontal" :aria-label="`${label} 编辑区和错误列表高度`"
      :aria-controls="`${id}-editor ${id}-errors`" :aria-valuemin="minimumErrorHeight"
      :aria-valuemax="maximumErrorHeight" :aria-valuenow="currentErrorHeight" tabindex="0"
      title="拖动调整编辑区与错误列表高度"
      @pointerdown="onSplitterPointerDown" @pointermove="onSplitterPointerMove"
      @pointerup="onSplitterPointerUp" @pointercancel="onSplitterPointerUp" @keydown="onSplitterKeydown"
    ></div>
    <ul v-if="errors.length" ref="errorList" :id="`${id}-errors`" class="property-text-errors" role="alert"
      :class="{ 'is-resizable': fillHeight && errorHeight !== null }"
      :style="errorHeight === null ? undefined : { '--property-text-errors-height': `${errorHeight}px` }">
      <li v-for="(error, index) in errors" :key="index">{{ error }}</li>
    </ul>
    <div class="property-text-footer">
      <span class="property-text-status" role="status" aria-live="polite">
        {{ draft.saving ? '保存中' : draft.notice || (dirty ? '未保存' : '未修改') }}
      </span>
      <div class="property-text-actions">
        <button
          type="button" class="property-text-action" title="丢弃草稿并重新载入" aria-label="丢弃草稿并重新载入"
          :disabled="draft.saving || (!dirty && !hasConflict)" @click="reload"
        ><RotateCcw :size="18" aria-hidden="true" /></button>
        <button
          type="button" class="property-text-action" title="复制文本" aria-label="复制文本"
          :disabled="draft.copying" @click="copy"
        ><Copy :size="18" aria-hidden="true" /></button>
        <button
          type="button" class="property-text-action property-text-save"
          :title="`保存 ${label}（Ctrl+S）`" :aria-label="`保存 ${label}（Ctrl+S）`"
          :disabled="!canSave" :aria-busy="draft.saving" @click="save"
        ><Save :size="18" aria-hidden="true" /></button>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, toRef, useId, watch } from 'vue';
import { Copy, RotateCcw, Save } from '@lucide/vue';
import { usePropertyTextEditor } from '../../app/composables/usePropertyTextEditor.js';

const props = defineProps({
  entity: { type: Object, required: true },
  label: { type: String, required: true },
  adapter: { type: Object, required: true },
  context: { type: Object, required: true },
  format: { type: String, default: 'json', validator: (value) => ['json', 'yaml'].includes(value) },
  drafts: { type: Map, required: true },
  persistChanges: { type: Function, required: true },
  fillHeight: { type: Boolean, default: false },
});
const jsonLanguageId = 'property-json5';
const id = useId();
const editorSection = ref(null);
const errorSplitter = ref(null);
const errorList = ref(null);
const monacoHost = ref(null);
const loadingEditor = ref(false);
const loadError = ref('');
const formatLabel = computed(() => props.format.toUpperCase());
const { draft, dirty, errors, canSave, hasConflict, save, copy, reload } = usePropertyTextEditor({
  entity: toRef(props, 'entity'),
  label: props.label,
  format: toRef(props, 'format'),
  drafts: props.drafts,
  serialize: (entity, format) => props.adapter.serialize(entity, format),
  parse: (text, format) => props.adapter.parse(text, props.context, format),
  capture: (entity) => props.adapter.capture ? props.adapter.capture(entity) : JSON.parse(props.adapter.serialize(entity)),
  apply: props.adapter.apply,
  restore: props.adapter.restore,
  persistChanges: () => props.persistChanges(),
});
const minimumErrorHeight = 48;
const minimumEditorHeight = 120;
const maximumErrorHeight = ref(360);
const errorHeight = ref(null);
const splitterDrag = ref(null);
const currentErrorHeight = computed(() => Math.round(errorHeight.value
  ?? Math.min(120, Math.max(minimumErrorHeight, errors.value.length * 22))));
defineExpose({ save });

let monacoApi = null;
let monacoEditor = null;
let resizeObserver = null;
let overflowTargetObserver = null;
let disposed = false;
let syncingFromDraft = false;

function resolveOverflowWidgetsTarget() {
  return document.fullscreenElement
    || monacoHost.value?.closest('.feature-panel.is-fullscreen')
    || document.body;
}

function updateOverflowWidgetsTarget() {
  monacoEditor?.updateOptions({ overflowWidgetsDomNode: resolveOverflowWidgetsTarget() });
}

function refreshEditorLayout() {
  monacoEditor?.layout();
  requestAnimationFrame(() => monacoEditor?.layout());
}

function registerJson5Language() {
  if (monacoApi.languages.getLanguages().some(({ id: languageId }) => languageId === jsonLanguageId)) return;
  monacoApi.languages.register({ id: jsonLanguageId, aliases: ['JSON', 'JSON5'] });
}

function registerJson5Tokenizer() {
  monacoApi.languages.setMonarchTokensProvider(jsonLanguageId, {
    tokenizer: {
      root: [
        [/\s+/, 'white'],
        [/\/\/.*$/, 'comment'],
        [/\/\*/, 'comment', '@comment'],
        [/"(?:[^"\\]|\\.)*"(?=\s*:)/, 'string.key.json'],
        [/'(?:[^'\\]|\\.)*'(?=\s*:)/, 'string.key.json'],
        [/"(?:[^"\\]|\\.)*"/, 'string.value.json'],
        [/'(?:[^'\\]|\\.)*'/, 'string.value.json'],
        [/[{}()\[\]]/, '@brackets'],
        [/[:,]/, 'delimiter'],
        [/[A-Za-z_$][\w$]*(?=\s*:)/, 'string.key.json'],
        [/[+-]?0[xX][\da-fA-F]+/, 'number.hex'],
        [/[+-]?(?:Infinity|NaN)\b/, 'number'],
        [/[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/, 'number'],
        [/\b(?:true|false|null)\b/, 'keyword'],
        [/[A-Za-z_$][\w$]*/, 'identifier'],
      ],
      comment: [
        [/[^*/]+/, 'comment'],
        [/\*\//, 'comment', '@pop'],
        [/[*/]/, 'comment'],
      ],
    },
  });
  monacoApi.languages.setLanguageConfiguration(jsonLanguageId, {
    brackets: [['{', '}'], ['[', ']']],
    autoClosingPairs: [
      { open: '{', close: '}' }, { open: '[', close: ']' },
      { open: '"', close: '"' }, { open: "'", close: "'" },
    ],
  });
}

async function configureYamlLanguage() {
  const { language, conf } = await import('monaco-editor/languages/definitions/yaml/yaml');
  monacoApi.languages.setMonarchTokensProvider('yaml', language);
  monacoApi.languages.setLanguageConfiguration('yaml', conf);
}

async function loadEditor() {
  if (loadingEditor.value || disposed) return;
  loadingEditor.value = true;
  loadError.value = '';
  try {
    const [monacoModule, workerModule] = await Promise.all([
      import('monaco-editor/editor/editor.api'),
      import('monaco-editor/editor/editor.worker?worker'),
      import('monaco-editor/editor/contrib/find/browser/findController'),
      import('monaco-editor/editor/contrib/folding/browser/folding'),
      import('monaco-editor/features/codicon/register'),
      import('monaco-editor/languages/definitions/yaml/register'),
    ]);
    if (disposed || !monacoHost.value) return;
    monacoApi = monacoModule;
    registerJson5Language();
    const fontFamily = getComputedStyle(monacoHost.value)
      .getPropertyValue('--font-code').trim() || 'Consolas, monospace';
    const primaryFontFamily = fontFamily.split(',')[0].trim().replace(/^['"]|['"]$/g, '');
    if (primaryFontFamily && document.fonts?.load) {
      await document.fonts.load(`12px "${primaryFontFamily}"`);
    }
    if (disposed || !monacoHost.value) return;
    const global = globalThis;
    global.MonacoEnvironment ||= {};
    global.MonacoEnvironment.getWorker ||= () => new workerModule.default();
    monacoApi.editor.defineTheme('property-text-warm', {
      base: 'vs',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#FFFCF8',
        'editor.foreground': '#3D3D3A',
        'editorLineNumber.foreground': '#8E8B82',
        'editorLineNumber.activeForeground': '#6C6A64',
        'editorCursor.foreground': '#A9583E',
        'editor.selectionBackground': '#EFD8C8',
        'editor.inactiveSelectionBackground': '#F5E8DE',
        'editorIndentGuide.background1': '#E8DCCF',
        'editorIndentGuide.activeBackground1': '#D3B7A2',
        'editorGutter.background': '#FFFCF8',
      },
    });
    monacoEditor = monacoApi.editor.create(monacoHost.value, {
      value: '',
      language: 'plaintext',
      theme: 'property-text-warm',
      automaticLayout: false,
      minimap: { enabled: false },
      lineNumbers: 'on',
      folding: true,
      foldingStrategy: 'indentation',
      showFoldingControls: 'always',
      wordWrap: 'off',
      scrollBeyondLastLine: false,
      fontFamily,
      fontSize: 12,
      lineHeight: 19,
      tabSize: 2,
      insertSpaces: true,
      readOnly: draft.value.saving,
      renderLineHighlight: 'line',
      overviewRulerLanes: 0,
      scrollbar: { alwaysConsumeMouseWheel: false },
      overflowWidgetsDomNode: resolveOverflowWidgetsTarget(),
      ariaLabel: `${props.label} 属性 ${formatLabel.value}`,
    });
    monacoEditor.setValue(draft.value.text);
    registerJson5Tokenizer();
    if (props.format === 'yaml') await configureYamlLanguage();
    monacoApi.editor.setModelLanguage(
      monacoEditor.getModel(), props.format === 'yaml' ? 'yaml' : jsonLanguageId,
    );
    refreshEditorLayout();
    monacoEditor.onDidChangeModelContent(() => {
      if (syncingFromDraft || !monacoEditor) return;
      draft.value.text = monacoEditor.getValue();
    });
    resizeObserver = new ResizeObserver(() => {
      monacoEditor?.layout();
      updateOverflowWidgetsTarget();
    });
    resizeObserver.observe(monacoHost.value);
    const fullscreenRoot = monacoHost.value.closest('.feature-panel');
    if (fullscreenRoot && typeof MutationObserver !== 'undefined') {
      overflowTargetObserver = new MutationObserver(updateOverflowWidgetsTarget);
      overflowTargetObserver.observe(fullscreenRoot, { attributes: true, attributeFilter: ['class'] });
    }
    document.addEventListener('fullscreenchange', updateOverflowWidgetsTarget);
    monacoEditor.layout();
  } catch (error) {
    if (!disposed) loadError.value = `代码编辑器加载失败：${error?.message || '请检查网络或刷新重试。'}`;
  } finally {
    if (!disposed) loadingEditor.value = false;
  }
}

watch(() => draft.value.text, (value) => {
  if (!monacoEditor || monacoEditor.getValue() === value) return;
  syncingFromDraft = true;
  monacoEditor.setValue(value);
  syncingFromDraft = false;
  refreshEditorLayout();
});

watch(() => draft.value.saving, (saving) => {
  monacoEditor?.updateOptions({ readOnly: saving });
});

watch(() => props.format, async (format) => {
  const model = monacoEditor?.getModel();
  if (!model || !monacoApi) return;
  try {
    if (format === 'yaml') await configureYamlLanguage();
    if (!monacoEditor || props.format !== format) return;
    monacoApi.editor.setModelLanguage(model, format === 'yaml' ? 'yaml' : jsonLanguageId);
    refreshEditorLayout();
  } catch (error) {
    loadError.value = `代码编辑器语法加载失败：${error?.message || '请检查网络或刷新重试。'}`;
  }
});

onMounted(() => {
  window.addEventListener('keydown', handleKeydown, true);
  loadEditor();
});
onBeforeUnmount(() => {
  disposed = true;
  window.removeEventListener('keydown', handleKeydown, true);
  resizeObserver?.disconnect();
  overflowTargetObserver?.disconnect();
  document.removeEventListener('fullscreenchange', updateOverflowWidgetsTarget);
  monacoEditor?.dispose();
  monacoEditor = null;
  monacoApi = null;
});

function handleKeydown(event) {
  const eventTarget = event.target instanceof Node ? event.target : null;
  const editorHasFocus = (eventTarget && editorSection.value?.contains(eventTarget))
    || editorSection.value?.contains(document.activeElement)
    || monacoEditor?.hasTextFocus();
  if (!editorHasFocus) return;
  if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return;
  const key = event.key.toLowerCase();
  if (!['s', 'f', 'h'].includes(key)) return;
  event.preventDefault();
  event.stopPropagation();
  if (key === 's') save();
  if (key === 'f') monacoEditor?.getAction('actions.find')?.run();
  if (key === 'h') monacoEditor?.getAction('editor.action.startFindReplaceAction')?.run();
}

function getMaximumErrorHeight() {
  const sectionHeight = editorSection.value?.clientHeight || 0;
  const footerHeight = editorSection.value?.querySelector('.property-text-footer')?.offsetHeight || 0;
  const splitterHeight = errorSplitter.value?.offsetHeight || 18;
  return Math.max(minimumErrorHeight, Math.min(360,
    sectionHeight - footerHeight - splitterHeight - minimumEditorHeight));
}

function setErrorHeight(height) {
  maximumErrorHeight.value = getMaximumErrorHeight();
  errorHeight.value = Math.max(minimumErrorHeight,
    Math.min(maximumErrorHeight.value, height));
}

function getCurrentErrorHeight() {
  return errorHeight.value ?? errorList.value?.getBoundingClientRect().height ?? currentErrorHeight.value;
}

function onSplitterPointerDown(event) {
  if (event.button !== 0 && event.pointerType === 'mouse') return;
  event.preventDefault();
  maximumErrorHeight.value = getMaximumErrorHeight();
  splitterDrag.value = {
    pointerId: event.pointerId,
    startY: event.clientY,
    startHeight: errorList.value?.getBoundingClientRect().height || currentErrorHeight.value,
  };
  errorSplitter.value?.setPointerCapture(event.pointerId);
}

function onSplitterPointerMove(event) {
  if (!splitterDrag.value || splitterDrag.value.pointerId !== event.pointerId) return;
  setErrorHeight(splitterDrag.value.startHeight - (event.clientY - splitterDrag.value.startY));
}

function onSplitterPointerUp(event) {
  if (!splitterDrag.value || splitterDrag.value.pointerId !== event.pointerId) return;
  splitterDrag.value = null;
}

function onSplitterKeydown(event) {
  const step = event.shiftKey ? 40 : 10;
  if (event.key === 'ArrowUp') setErrorHeight(getCurrentErrorHeight() + step);
  else if (event.key === 'ArrowDown') setErrorHeight(getCurrentErrorHeight() - step);
  else if (event.key === 'Home') setErrorHeight(minimumErrorHeight);
  else if (event.key === 'End') setErrorHeight(getMaximumErrorHeight());
  else return;
  event.preventDefault();
}
</script>

<style scoped>
.property-text-editor { min-width: 0; }
.property-text-editor.is-expanded {
  display: flex;
  flex-direction: column;
  flex: 1 1 0;
  min-height: 0;
}
.property-text-editor.is-expanded .property-text-editor-host {
  flex: 1 1 0;
  min-height: 120px;
}
.property-text-editor.is-expanded .property-text-monaco {
  min-height: 0;
}
.property-text-editor.is-expanded .property-text-errors {
  flex: 0 1 auto;
  max-height: 120px;
  overflow: auto;
  margin: 4px 0;
}
.property-text-editor.is-expanded .property-text-errors.is-resizable {
  flex: 0 1 var(--property-text-errors-height);
  height: var(--property-text-errors-height);
  min-height: 48px;
  max-height: none;
}
.property-text-splitter {
  position: relative;
  flex: 0 0 18px;
  min-height: 18px;
  cursor: ns-resize;
  touch-action: none;
  user-select: none;
}
.property-text-splitter::after {
  position: absolute;
  top: 7px;
  left: 50%;
  width: 36px;
  height: 4px;
  border-radius: 2px;
  background: var(--color-hairline);
  content: '';
  transform: translateX(-50%);
}
.property-text-splitter:hover::after { background: var(--color-primary); }
.property-text-splitter:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: -2px;
}
@media (pointer: coarse) {
  .property-text-splitter { flex-basis: 44px; min-height: 44px; }
  .property-text-splitter::after { top: 20px; }
}
.property-text-editor.is-expanded .property-text-footer {
  flex: 0 0 auto;
  margin-top: 4px;
}
.property-text-label {
  display: block;
  margin-bottom: 6px;
  color: var(--color-body);
  font-size: 12px;
}
.property-text-editor-host {
  position: relative;
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  min-height: 288px;
  overflow: visible;
  border: 1px solid var(--color-hairline);
  border-radius: var(--radius-md);
  background: #fffcf8;
}
.property-text-monaco {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 288px;
}
.property-text-editor-host:focus-within { border-color: #d7a48d; }
.property-text-editor-host.has-errors { border-color: var(--bs-danger); }
.property-text-editor.is-expanded .property-text-monaco { height: 100%; }
.property-text-loading,
.property-text-load-error {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  background: #fffcf8;
  color: var(--color-muted);
  font-size: 12px;
}
.property-text-load-error { flex-direction: column; gap: 8px; color: var(--color-body); }
.property-text-fallback {
  box-sizing: border-box;
  width: 100%;
  min-height: 180px;
  resize: vertical;
  box-sizing: border-box;
}
.property-text-retry { min-height: 40px; padding: 6px 12px; cursor: pointer; }
.property-text-errors {
  margin: 8px 0;
  padding-left: 20px;
  color: var(--color-body);
  font-size: 12px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.property-text-footer,
.property-text-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}
.property-text-footer {
  justify-content: space-between;
  flex-wrap: wrap;
  margin-top: 8px;
}
.property-text-status { color: var(--color-muted); font-size: 12px; }
.property-text-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 0;
  border-radius: var(--radius-sm);
  color: var(--color-body);
  background: transparent;
  cursor: pointer;
}
.property-text-save { color: var(--color-primary-active); }
.property-text-action:hover:not(:disabled) { background: var(--color-surface-soft); }
.property-text-action:focus-visible { outline: 2px solid var(--color-primary-active); outline-offset: 2px; }
.property-text-action:disabled { opacity: 0.4; cursor: not-allowed; }
</style>