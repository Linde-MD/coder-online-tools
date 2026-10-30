<template>
  <div class="property-mode-toolbar" :class="{ 'is-compact': compact }">
    <span v-if="!compact" class="property-mode-format">{{ modelValue === 'form' ? '' : modelValue === 'yaml' ? 'YAML' : 'JSON' }}</span>
    <div class="property-mode-options" role="group" :aria-label="`${label} 编辑方式`">
      <button
        v-for="option in visibleOptions"
        :key="option.value"
        type="button"
        class="property-mode-button"
        :aria-pressed="modelValue === option.value"
        :title="option.value === 'form' ? formLabel : option.title"
        :aria-label="option.value === 'form' ? formLabel : option.title"
        @click="emit('update:modelValue', option.value)"
      ><component :is="option.icon" :size="18" aria-hidden="true" /></button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { CodeXml, FileText, List } from '@lucide/vue';

const props = defineProps({
  modelValue: { type: String, default: 'form' },
  label: { type: String, required: true },
  showForm: { type: Boolean, default: true },
  compact: { type: Boolean, default: false },
  formLabel: { type: String, default: '表单编辑' },
});
const emit = defineEmits(['update:modelValue']);
const options = [
  { value: 'form', title: '表单编辑', icon: List },
  { value: 'text', title: '文本编辑（JSON）', icon: CodeXml },
  { value: 'yaml', title: '文本编辑（YAML）', icon: FileText },
];
const visibleOptions = computed(() => options.filter((option) => props.showForm || option.value !== 'form'));
</script>

<style scoped>
.property-mode-toolbar,
.property-mode-options {
  display: flex;
  align-items: center;
}
.property-mode-toolbar {
  justify-content: space-between;
  margin-bottom: 6px;
}
.property-mode-toolbar.is-compact { margin-bottom: 0; }
.property-mode-format {
  color: var(--color-muted);
  font: 12px var(--font-code);
}
.property-mode-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 0;
  border-radius: var(--radius-sm);
  color: var(--color-muted);
  background: transparent;
  cursor: pointer;
}
.property-mode-button:hover {
  background: var(--color-surface-soft);
  color: var(--color-ink);
}
.property-mode-button[aria-pressed='true'] {
  color: var(--color-primary-active);
  background: var(--color-surface-soft);
  box-shadow: inset 0 -2px var(--color-primary-active);
}
.property-mode-button:focus-visible {
  outline: 2px solid var(--color-primary-active);
  outline-offset: 2px;
}
</style>