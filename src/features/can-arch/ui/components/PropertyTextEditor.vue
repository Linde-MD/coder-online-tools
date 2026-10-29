<template>
  <section class="property-text-editor" :aria-label="`${label} 文本编辑`" @keydown="handleKeydown">
    <label :for="id" class="property-text-label">{{ label }} {{ formatLabel }}</label>
    <textarea
      :id="id"
      v-model="draft.text"
      class="form-control property-text-input"
      :aria-label="`${label} 属性 ${formatLabel}`"
      :aria-invalid="errors.length > 0"
      :aria-describedby="errors.length ? `${id}-errors` : undefined"
      :readonly="draft.saving"
      spellcheck="false"
      autocapitalize="off"
      autocomplete="off"
      wrap="off"
    ></textarea>
    <ul v-if="errors.length" :id="`${id}-errors`" class="property-text-errors" role="alert">
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
import { computed, toRef, useId } from 'vue';
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
});
const id = useId();
const formatLabel = computed(() => props.format.toUpperCase());
const { draft, dirty, errors, canSave, hasConflict, save, copy, reload } = usePropertyTextEditor({
  entity: toRef(props, 'entity'),
  label: props.label,
  format: toRef(props, 'format'),
  drafts: props.drafts,
  serialize: (entity, format) => props.adapter.serialize(entity, format),
  parse: (text, format) => props.adapter.parse(text, props.context, format),
  capture: (entity) => props.adapter.capture ? props.adapter.capture(entity) : JSON.parse(props.adapter.serialize(entity)),
  persistChanges: () => props.persistChanges(),
});
defineExpose({ save });

function handleKeydown(event) {
  if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 's') {
    event.preventDefault();
    event.stopPropagation();
    save();
  }
}
</script>

<style scoped>
.property-text-editor { min-width: 0; }
.property-text-label {
  display: block;
  margin-bottom: 6px;
  color: var(--color-body);
  font-size: 12px;
}
.property-text-input {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  min-height: 288px;
  resize: vertical;
  overflow: auto;
  font-family: var(--font-code);
  font-size: 12px;
  line-height: 1.6;
  tab-size: 2;
}
.property-text-input[aria-invalid='true'] { border-color: var(--bs-danger); }
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