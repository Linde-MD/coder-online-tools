<template>
  <PropertyTextEditor
    ref="editorRef" :entity="signal" label="Signal" :adapter="adapter" :context="{ message }"
    :format="format" :drafts="drafts" :persist-changes="persistChanges"
  />
</template>

<script setup>
import { ref } from 'vue';
import PropertyTextEditor from './PropertyTextEditor.vue';
import { parseSignalProperties, serializeSignalProperties } from '../../services/signal-properties-text.js';

defineProps({
  signal: { type: Object, required: true },
  message: { type: Object, required: true },
  format: { type: String, default: 'json', validator: (value) => ['json', 'yaml'].includes(value) },
  drafts: { type: Map, required: true },
  persistChanges: { type: Function, required: true },
});
const editorRef = ref(null);
const adapter = {
  serialize: serializeSignalProperties,
  parse: (text, context, format) => parseSignalProperties(text, context.message, format),
};
defineExpose({ save: () => editorRef.value?.save() });
</script>