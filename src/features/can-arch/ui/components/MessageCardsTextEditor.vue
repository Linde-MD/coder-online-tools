<template>
  <div class="message-cards-text" @contextmenu.stop>
    <span class="message-cards-text-note">编辑当前 BUS 分栏的全部 {{ messages.length }} 条报文，不受卡片筛选影响</span>
    <PropertyTextEditor
      :entity="entity" :label="`${paneLabel}报文列表`" :adapter="adapter" :context="context"
      :format="mode === 'yaml' ? 'yaml' : 'json'" :drafts="drafts" :persist-changes="persistChanges" fill-height
    />
  </div>
</template>

<script setup>
import { computed, shallowRef, watch } from 'vue';
import PropertyTextEditor from './PropertyTextEditor.vue';
import { parseMessageCards, serializeMessageCards } from '../../services/message-cards-text.js';

const props = defineProps({
  mode: { type: String, required: true },
  pane: { type: String, required: true },
  ecuId: { type: String, required: true },
  busId: { type: String, required: true },
  messages: { type: Array, required: true },
  participants: { type: Array, required: true },
  drafts: { type: Map, required: true },
  persistChanges: { type: Function, required: true },
});
const paneLabel = computed(() => props.pane === 'rx' ? '接收' : '发送');
const entity = shallowRef({
  id: `message-cards:${props.ecuId}:${props.busId}:${props.pane}`,
  messages: props.messages,
});
watch(() => props.messages, (messages) => {
  entity.value.messages = messages;
}, { flush: 'sync' });
const context = computed(() => ({
  messages: props.messages,
  participants: props.participants,
  currentEcuId: props.ecuId,
  pane: props.pane,
}));
const adapter = {
  serialize: (value, format) => serializeMessageCards(value.messages, format, props.participants),
  parse: (text, parseContext, format) => parseMessageCards(text, parseContext, format),
  capture: () => [...props.messages],
  apply: (target, value) => {
    props.messages.splice(0, props.messages.length, ...value.messages);
    target.messages = props.messages;
  },
  restore: (target, snapshot) => {
    props.messages.splice(0, props.messages.length, ...snapshot);
    target.messages = props.messages;
  },
};
</script>

<style scoped>
.message-cards-text {
  display: flex;
  flex: 1 1 0;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  padding: 8px;
}
.message-cards-text-note {
  flex: 0 0 auto;
  margin-bottom: 4px;
  color: var(--color-muted);
  font-size: 11px;
}
</style>