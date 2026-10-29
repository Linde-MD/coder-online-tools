<template>
  <div ref="root" class="participant-picker" :aria-label="`添加${label}`" @keydown.esc.stop.prevent="emit('cancel')">
    <label v-if="showBroadcast" class="participant-picker-option participant-picker-broadcast">
      <input v-model="broadcastSelection" class="participant-picker-input" type="checkbox">
      <span>broadcast</span>
    </label>
    <div class="participant-picker-list">
      <label v-for="option in options" :key="option.id" class="participant-picker-option">
        <input v-model="selection" class="participant-picker-input" type="checkbox" :value="option.id">
        <span>{{ option.name }}</span>
      </label>
      <span v-if="!options.length" class="participant-picker-empty">暂无可添加节点</span>
    </div>
    <div class="participant-picker-actions">
      <button
        type="button" class="participant-picker-action" :title="`取消添加${label}`"
        :aria-label="`取消添加${label}`" @click="emit('cancel')"
      ><X :size="18" aria-hidden="true" /></button>
      <button
        type="button" class="participant-picker-action participant-picker-confirm" :title="`确认添加${label}`"
        :aria-label="`确认添加${label}`" :disabled="!canConfirm" @click="emit('confirm')"
      ><Check :size="18" aria-hidden="true" /></button>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { Check, X } from '@lucide/vue';

const props = defineProps({
  label: { type: String, required: true },
  options: { type: Array, required: true },
  selected: { type: Array, required: true },
  showBroadcast: { type: Boolean, default: false },
  broadcast: { type: Boolean, default: false },
  canConfirm: { type: Boolean, required: true },
});
const emit = defineEmits(['update:selected', 'update:broadcast', 'cancel', 'confirm']);
const root = ref(null);
const selection = computed({ get: () => props.selected, set: (value) => emit('update:selected', value) });
const broadcastSelection = computed({ get: () => props.broadcast, set: (value) => emit('update:broadcast', value) });
onMounted(() => root.value?.querySelector('input')?.focus());
</script>

<style scoped>
.participant-picker {
  min-width: 0;
  padding-top: 4px;
  border-top: 1px solid var(--color-hairline);
  color: var(--color-body);
}
.participant-picker-list {
  display: flex;
  flex-direction: column;
  max-height: 220px;
  overflow: auto;
}
.participant-picker-option {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  padding: 4px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  cursor: pointer;
}
.participant-picker-option:hover { background: var(--color-surface-soft); }
.participant-picker-option span { min-width: 0; overflow-wrap: anywhere; }
.participant-picker-broadcast { border-bottom: 1px solid var(--color-hairline); }
.participant-picker-input {
  flex: 0 0 16px;
  width: 16px;
  height: 16px;
  margin: 0;
  accent-color: var(--color-primary);
  cursor: pointer;
}
.participant-picker-actions { display: flex; justify-content: flex-end; gap: 4px; }
.participant-picker-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-body);
  cursor: pointer;
}
.participant-picker-confirm { color: var(--color-primary-active); }
.participant-picker-action:hover:not(:disabled) { background: var(--color-surface-soft); }
.participant-picker-action:disabled { opacity: 0.4; cursor: not-allowed; }
.participant-picker-action:focus-visible,
.participant-picker-input:focus-visible { outline: 2px solid var(--color-primary-active); outline-offset: 2px; }
.participant-picker-empty { padding: 8px 4px; color: var(--color-muted); font-size: 12px; }
</style>