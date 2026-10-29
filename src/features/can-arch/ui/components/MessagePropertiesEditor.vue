<template>
  <div class="message-properties" @keydown="handleKeydown">
    <PropertyEditorModeSwitch :model-value="mode" label="Message" @update:model-value="emit('update:mode', $event)" />
    <slot v-if="mode === 'form'"></slot>
    <PropertyTextEditor
      v-else ref="textEditorRef" :entity="message" label="Message" :adapter="adapter" :context="context"
      :format="mode === 'yaml' ? 'yaml' : 'json'" :drafts="drafts" :persist-changes="persistChanges"
    />
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import PropertyEditorModeSwitch from './PropertyEditorModeSwitch.vue';
import PropertyTextEditor from './PropertyTextEditor.vue';
import { captureMessageProperties, parseMessageProperties, serializeMessageProperties } from '../../services/message-properties-text.js';

const props = defineProps({
  message: { type: Object, required: true },
  mode: { type: String, default: 'form' },
  participants: { type: Array, required: true },
  currentEcuId: { type: String, required: true },
  pane: { type: String, required: true },
  drafts: { type: Map, required: true },
  persistChanges: { type: Function, required: true },
});
const emit = defineEmits(['update:mode']);
const textEditorRef = ref(null);
const adapter = {
  serialize: (message, format) => serializeMessageProperties(message, format, props.participants),
  parse: parseMessageProperties,
  capture: captureMessageProperties,
};
const context = computed(() => ({
  message: props.message, participants: props.participants, currentEcuId: props.currentEcuId, pane: props.pane,
}));

function handleKeydown(event) {
  if (props.mode !== 'form' && (event.ctrlKey || event.metaKey)
    && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 's') {
    event.preventDefault();
    event.stopPropagation();
    textEditorRef.value?.save();
  }
}
</script>