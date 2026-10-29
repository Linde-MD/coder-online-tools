<template>
  <div class="message-document-host">
    <Teleport :to="windowPanel.portalTarget.value" :disabled="!floating">
    <div v-if="windowPanel.dockPreview.value" class="message-document-dock-preview" :style="windowPanel.previewStyle.value" aria-hidden="true">
      <span>停靠到右侧</span>
    </div>
    <section
      ref="frameRef" class="message-document-editor" :class="{ 'is-floating': floating, 'is-interacting': windowPanel.interacting.value }"
      :style="frameStyle" :role="floating ? 'dialog' : 'region'"
      :aria-label="floating ? 'Message 与全部 Signal 独立窗口' : 'Message 与全部 Signal 编辑器'"
      :aria-modal="floating ? 'false' : undefined" @keydown="handleKeydown"
    >
      <header
        class="message-document-heading" tabindex="0" aria-label="拖动完整报文窗口" title="拖拽标题栏分离或移动窗口"
        @pointerdown="windowPanel.startDrag" @keydown="windowPanel.moveWithKeyboard"
      >
        <button
          class="message-document-tool" type="button" title="返回属性编辑" aria-label="返回属性编辑"
          @pointerdown.stop @click="emit('close')"
        ><ArrowLeft :size="18" aria-hidden="true" /></button>
        <strong :title="message.name">{{ message.name }}</strong>
        <PropertyEditorModeSwitch
          :model-value="mode" label="完整报文" :show-form="false" compact
          @pointerdown.stop @update:model-value="emit('update:mode', $event)"
        />
        <button
          class="message-document-tool" type="button" :title="floating ? '停靠到右侧' : '独立窗口'"
          :aria-label="floating ? '停靠到右侧' : '独立窗口'" :aria-pressed="floating"
          @pointerdown.stop @click="windowPanel.toggle"
        ><component :is="floating ? PanelRightClose : ExternalLink" :size="18" aria-hidden="true" /></button>
      </header>
      <PropertyTextEditor
        ref="editorRef" :entity="message" label="完整报文" :adapter="adapter" :context="context" fill-height
        :format="mode === 'yaml' ? 'yaml' : 'json'" :drafts="drafts" :persist-changes="persistChanges"
      />
      <button
        v-if="floating" class="message-document-resize" type="button" title="调整窗口大小（方向键）" aria-label="调整独立窗口大小"
        @pointerdown.stop.prevent="windowPanel.startResize" @keydown="windowPanel.resizeWithKeyboard"
      ><MoveDiagonal2 :size="18" aria-hidden="true" /></button>
    </section>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, ref, toRef } from 'vue';
import { ArrowLeft, ExternalLink, MoveDiagonal2, PanelRightClose } from '@lucide/vue';
import PropertyEditorModeSwitch from './PropertyEditorModeSwitch.vue';
import PropertyTextEditor from './PropertyTextEditor.vue';
import { useDockableEditorWindow } from '../../app/composables/useDockableEditorWindow.js';
import { captureMessageDocument, parseMessageDocument, serializeMessageDocument } from '../../services/message-document-text.js';

const props = defineProps({
  message: { type: Object, required: true },
  mode: { type: String, default: 'yaml' },
  participants: { type: Array, required: true },
  currentEcuId: { type: String, required: true },
  pane: { type: String, required: true },
  drafts: { type: Map, required: true },
  persistChanges: { type: Function, required: true },
  floating: { type: Boolean, default: false },
  dockRoot: { type: Object, default: null },
  dockWidth: { type: Number, default: 300 },
});
const emit = defineEmits(['close', 'update:mode', 'update:floating']);
const editorRef = ref(null);
const frameRef = ref(null);
const windowPanel = useDockableEditorWindow({
  frame: frameRef, workspace: toRef(props, 'dockRoot'), dockWidth: toRef(props, 'dockWidth'), floating: toRef(props, 'floating'),
  setFloating: (value) => emit('update:floating', value),
});
const frameStyle = computed(() => {
  if (!props.floating) return {};
  const style = windowPanel.windowStyle.value;
  return {
    '--editor-window-left': style.left,
    '--editor-window-top': style.top,
    '--editor-window-width': style.width,
    '--editor-window-height': style.height,
    '--editor-window-min-top': style['--editor-window-min-top'],
  };
});
const adapter = {
  serialize: (message, format) => serializeMessageDocument(message, format, props.participants),
  parse: parseMessageDocument,
  capture: captureMessageDocument,
};
const context = computed(() => ({
  message: props.message, participants: props.participants, currentEcuId: props.currentEcuId, pane: props.pane,
}));

function handleKeydown(event) {
  if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 's') {
    event.preventDefault();
    event.stopPropagation();
    editorRef.value?.save();
  }
}
</script>

<style scoped>
.message-document-host,
.message-document-editor {
  display: flex;
  flex-direction: column;
  flex: 1 1 0;
  min-width: 0;
  min-height: 0;
}
.message-document-editor { background: var(--color-canvas); padding: 4px; }
.message-document-heading { display: flex; align-items: center; gap: 4px; flex: 0 0 auto; cursor: grab; touch-action: none; }
.message-document-heading strong {
  flex: 1 1 0;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--color-body);
  font-size: 13px;
}
.message-document-tool,
.message-document-resize {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 44px;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-body);
  cursor: pointer;
}
.message-document-tool:hover,
.message-document-resize:hover { background: var(--color-surface-soft); }
.message-document-tool:focus-visible,
.message-document-heading:focus-visible,
.message-document-resize:focus-visible { outline: 2px solid var(--color-primary-active); outline-offset: 2px; }
.message-document-editor.is-floating {
  --editor-visible-width: min(var(--editor-window-width), calc(100vw - 16px));
  --editor-visible-height: min(var(--editor-window-height), calc(100dvh - var(--editor-window-min-top) - 8px));
  position: fixed;
  left: clamp(8px, var(--editor-window-left), calc(100vw - var(--editor-visible-width) - 8px));
  top: clamp(var(--editor-window-min-top), var(--editor-window-top), calc(100dvh - var(--editor-visible-height) - 8px));
  width: var(--editor-visible-width);
  height: var(--editor-visible-height);
  z-index: 40;
  box-sizing: border-box;
  border: 1px solid var(--color-hairline);
  border-radius: var(--radius-md);
  box-shadow: 0 8px 24px rgba(20, 20, 19, 0.14);
  padding: 4px 8px;
}
.message-document-editor.is-floating :deep(.property-text-footer) { padding-right: 44px; }
.message-document-editor.is-interacting { user-select: none; }
.message-document-editor.is-interacting .message-document-heading { cursor: grabbing; }
.message-document-resize { position: absolute; right: 0; bottom: 0; cursor: nwse-resize; touch-action: none; }
.message-document-dock-preview {
  position: fixed;
  z-index: 41;
  display: grid;
  place-items: center;
  box-sizing: border-box;
  pointer-events: none;
  border: 2px dashed var(--color-primary-active);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--color-primary) 12%, transparent);
  color: var(--color-primary-active);
  font-size: 13px;
}
</style>