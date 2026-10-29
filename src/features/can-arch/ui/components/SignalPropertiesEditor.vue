<template>
  <div class="signal-properties" @keydown="handleKeydown">
    <PropertyEditorModeSwitch :model-value="mode" label="Signal" @update:model-value="emit('update:mode', $event)" />
    <template v-if="mode === 'form'">
    <div class="signal-properties-grid">
      <label :for="`${id}-name`">Signal 名称</label>
      <input :id="`${id}-name`" v-model="signal.name" class="form-control form-control-sm">

      <label :for="`${id}-start`">起始位</label>
      <div class="signal-properties-field">
        <input
          :id="`${id}-start`"
          v-model.number="signal.startBit"
          class="form-control form-control-sm"
          type="number"
          min="0"
          :max="validation.totalBits === null ? undefined : Math.max(0, validation.totalBits - 1)"
          step="1"
          :aria-invalid="Boolean(validation.startBitError)"
          :aria-describedby="validation.startBitError ? `${id}-start-error` : undefined"
        >
        <p v-if="validation.startBitError" :id="`${id}-start-error`" class="signal-properties-error" role="alert">
          错误：{{ validation.startBitError }}
        </p>
      </div>

      <label :for="`${id}-length`">长度(bit)</label>
      <div class="signal-properties-field">
        <input
          :id="`${id}-length`"
          v-model.number="signal.length"
          class="form-control form-control-sm"
          type="number"
          min="1"
          :max="validation.totalBits ?? undefined"
          step="1"
          :aria-invalid="Boolean(validation.lengthError)"
          :aria-describedby="validation.lengthError ? `${id}-length-error` : undefined"
        >
        <p v-if="validation.lengthError" :id="`${id}-length-error`" class="signal-properties-error" role="alert">
          错误：{{ validation.lengthError }}
        </p>
      </div>

      <p v-if="validation.messageError" class="signal-properties-error signal-properties-message-error" role="alert">
        错误：{{ validation.messageError }}
      </p>

      <label :for="`${id}-factor`">Factor</label>
      <input :id="`${id}-factor`" v-model.number="signal.factor" class="form-control form-control-sm" type="number" step="any">

      <label :for="`${id}-offset`">Offset</label>
      <input :id="`${id}-offset`" v-model.number="signal.offset" class="form-control form-control-sm" type="number" step="any">

      <label :for="`${id}-min`">物理最小值</label>
      <input
        :id="`${id}-min`"
        v-model="signal.min"
        class="form-control form-control-sm"
        type="number"
        step="any"
        placeholder="可留空"
        @blur="emit('physical-limit-blur', 'min')"
      >

      <label :for="`${id}-max`">物理最大值</label>
      <input
        :id="`${id}-max`"
        v-model="signal.max"
        class="form-control form-control-sm"
        type="number"
        step="any"
        placeholder="可留空"
        @blur="emit('physical-limit-blur', 'max')"
      >

      <label :for="`${id}-signed`">Signed</label>
      <label class="signal-properties-check" :for="`${id}-signed`">
        <input :id="`${id}-signed`" v-model="signal.signed" class="signal-properties-checkbox" type="checkbox">
        <span>有符号</span>
      </label>

      <label :for="`${id}-unit`">单位</label>
      <input :id="`${id}-unit`" v-model="signal.unit" class="form-control form-control-sm">
    </div>

    <div class="signal-properties-comment">
      <label :for="`${id}-comment`">注释</label>
      <textarea :id="`${id}-comment`" v-model="signal.comment" class="form-control form-control-sm" rows="2"></textarea>
    </div>
    </template>
    <SignalTextEditor
      v-else
      ref="textEditorRef"
      :signal="signal"
      :message="message"
      :format="textFormat"
      :drafts="drafts"
      :persist-changes="persistChanges"
    />
  </div>
</template>

<script setup>
import { computed, ref, useId } from 'vue';
import PropertyEditorModeSwitch from './PropertyEditorModeSwitch.vue';
import { validateSignalLayout } from '../../services/signal-layout.js';
import SignalTextEditor from './SignalTextEditor.vue';

const props = defineProps({
  signal: { type: Object, required: true },
  message: { type: Object, required: true },
  mode: { type: String, default: 'form' },
  drafts: { type: Map, required: true },
  persistChanges: { type: Function, required: true },
});
const emit = defineEmits(['physical-limit-blur', 'update:mode']);
const id = useId();
const textEditorRef = ref(null);
const textFormat = computed(() => props.mode === 'yaml' ? 'yaml' : 'json');
const validation = computed(() => validateSignalLayout(props.signal, props.message));

function handleKeydown(event) {
  if (props.mode !== 'form' && (event.ctrlKey || event.metaKey)
    && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 's') {
    event.preventDefault();
    event.stopPropagation();
    textEditorRef.value?.save();
  }
}
</script>

<style scoped>
.signal-properties-grid {
  display: grid;
  grid-template-columns: minmax(0, 96px) minmax(0, 1fr);
  gap: 6px;
  align-items: center;
}

.signal-properties label {
  font-size: 12px;
  color: var(--color-body);
  overflow-wrap: anywhere;
}

.signal-properties-field,
.signal-properties input,
.signal-properties textarea {
  min-width: 0;
}

.signal-properties input[aria-invalid='true'] {
  border-color: var(--bs-danger);
}

.signal-properties-error {
  margin: 4px 0 0;
  color: var(--color-body);
  font-size: 12px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.signal-properties-message-error {
  grid-column: 1 / -1;
}

.signal-properties-check {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  cursor: pointer;
}

.signal-properties-checkbox {
  width: 16px;
  height: 16px;
  margin: 0;
  accent-color: var(--color-primary);
  cursor: pointer;
}

.signal-properties-checkbox:focus-visible {
  outline: 2px solid var(--color-primary-active);
  outline-offset: 3px;
}

.signal-properties-comment {
  display: grid;
  gap: 6px;
  margin-top: 8px;
}
</style>