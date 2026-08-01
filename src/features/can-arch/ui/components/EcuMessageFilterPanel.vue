<template>
  <div
    class="ecu-floating-panel"
    :class="{ collapsed: panel.state.collapsed }"
    :style="panel.panelStyle()"
    @contextmenu.prevent
  >
    <header class="ecu-floating-panel-header" @pointerdown="panel.onDragStart">
      <span class="ecu-floating-panel-title">过滤器</span>
      <div class="ecu-floating-panel-actions">
        <button
          class="ecu-floating-btn"
          type="button"
          :title="panel.state.collapsed ? '展开' : '折叠'"
          @pointerdown.stop
          @click="panel.toggleCollapse()"
        >
          <span class="ecu-icon" v-if="!panel.state.collapsed">▼</span>
          <span class="ecu-icon" v-else>▲</span>
        </button>
        <button
          class="ecu-floating-btn"
          type="button"
          title="关闭"
          @pointerdown.stop
          @click="$emit('close')"
        >✕</button>
      </div>
    </header>

    <div class="ecu-floating-panel-body" v-show="!panel.state.collapsed">
      <div v-for="group in filterGroups" :key="group.key" class="ecu-filter-group">
        <div class="ecu-filter-head">
          <span>{{ group.label }}</span>
          <div class="ecu-filter-actions">
            <button
              class="ecu-icon-btn"
              type="button"
              :title="group.selectAllTitle"
              @click="group.onSelectAll()"
            >{{ group.selectAllIcon }}</button>
            <button
              class="ecu-icon-btn"
              type="button"
              :title="group.clearTitle"
              @click="group.onClear()"
            >{{ group.clearIcon }}</button>
          </div>
        </div>
        <div class="ecu-filter-list">
          <label
            v-for="opt in group.options"
            :key="opt.value"
            class="ecu-filter-item"
            :class="{ selected: group.isSelected(opt.value) }"
            @click.prevent="group.toggle(opt.value)"
          >
            <span class="ecu-filter-check" :class="{ checked: group.isSelected(opt.value) }">
              <span v-if="group.isSelected(opt.value)" class="ecu-filter-check-mark">✓</span>
            </span>
            <span class="ecu-filter-item-label">{{ opt.label }}</span>
          </label>
          <div v-if="!group.options.length" class="ecu-filter-empty">暂无选项</div>
        </div>
      </div>
    </div>

    <div
      v-if="!panel.state.collapsed"
      class="ecu-floating-resize-handle"
      @pointerdown.stop="panel.onResizeStart($event, 'se')"
    ></div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount } from 'vue';
import { useFloatingPanel } from '@/features/can-arch/app/composables/useFloatingPanel.js';
import { filterPanelPositionCache, saveFilterPanelPosition } from '@/features/can-arch/app/composables/useFilterPanelCache.js';

const props = defineProps({
  peerOptions: { type: Array, default: () => [] },
  protocolOptions: { type: Array, default: () => [] },
  filterPeerIds: { type: Array, default: () => [] },
  filterProtocols: { type: Array, default: () => [] },
  boundaryRef: { type: Object, default: null },
});

const emit = defineEmits(['update:filterPeerIds', 'update:filterProtocols', 'close']);

const panel = useFloatingPanel({
  initialX: filterPanelPositionCache.x,
  initialY: filterPanelPositionCache.y,
  initialWidth: filterPanelPositionCache.width,
  initialHeight: filterPanelPositionCache.height,
  initialCollapsed: filterPanelPositionCache.collapsed,
  minWidth: 200,
  minHeight: 160,
  boundaryRef: computed(() => props.boundaryRef?.value),
});

onBeforeUnmount(() => {
  saveFilterPanelPosition(panel.state);
});

function toggleValue(list, value) {
  const idx = list.indexOf(value);
  if (idx >= 0) {
    const next = [...list];
    next.splice(idx, 1);
    return next;
  }
  return [...list, value];
}

const filterGroups = computed(() => [
  {
    key: 'peer',
    label: '对端 ECU',
    options: props.peerOptions.map((p) => ({ value: p.id, label: p.name })),
    isSelected: (val) => props.filterPeerIds.includes(val),
    toggle: (val) => emit('update:filterPeerIds', toggleValue(props.filterPeerIds, val)),
    onSelectAll: () => emit('update:filterPeerIds', props.peerOptions.map((p) => p.id)),
    onClear: () => emit('update:filterPeerIds', []),
    selectAllIcon: '☑',
    clearIcon: '☐',
    selectAllTitle: '全选',
    clearTitle: '取消全选',
  },
  {
    key: 'protocol',
    label: '协议',
    options: props.protocolOptions.map((p) => ({ value: p.value, label: p.label })),
    isSelected: (val) => props.filterProtocols.includes(val),
    toggle: (val) => emit('update:filterProtocols', toggleValue(props.filterProtocols, val)),
    onSelectAll: () => emit('update:filterProtocols', props.protocolOptions.map((p) => p.value)),
    onClear: () => emit('update:filterProtocols', []),
    selectAllIcon: '☑',
    clearIcon: '☐',
    selectAllTitle: '全选',
    clearTitle: '取消全选',
  },
]);
</script>

<style scoped>
.ecu-floating-panel {
  position: absolute;
  z-index: 10;
  background: rgba(255, 252, 248, 0.97);
  border: 1px solid #c9b39c;
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(92, 69, 53, 0.2);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: box-shadow 0.15s;
}

.ecu-floating-panel.collapsed {
  box-shadow: 0 4px 12px rgba(92, 69, 53, 0.15);
}

.ecu-floating-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  background: linear-gradient(180deg, #f5eadb 0%, #ecdcc7 100%);
  cursor: grab;
  user-select: none;
  border-bottom: 1px solid #d4c2ad;
}

.ecu-floating-panel-header:active {
  cursor: grabbing;
}

.ecu-floating-panel-title {
  font-weight: 700;
  font-size: 13px;
  color: #5c4433;
}

.ecu-floating-panel-actions {
  display: inline-flex;
  gap: 2px;
}

.ecu-floating-btn {
  width: 22px;
  height: 22px;
  border: 0;
  background: transparent;
  color: #6c4d36;
  border-radius: 5px;
  display: grid;
  place-items: center;
  cursor: pointer;
  font-size: 11px;
  transition: background 0.12s;
}

.ecu-floating-btn:hover {
  background: rgba(151, 112, 84, 0.2);
}

.ecu-icon {
  line-height: 1;
}

.ecu-floating-panel-body {
  padding: 8px;
  display: grid;
  gap: 10px;
  overflow: auto;
  flex: 1;
  min-height: 0;
}

.ecu-filter-group {
  display: grid;
  gap: 4px;
}

.ecu-filter-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: #644b38;
  font-weight: 600;
}

.ecu-filter-actions {
  display: inline-flex;
  gap: 2px;
}

.ecu-icon-btn {
  width: 22px;
  height: 22px;
  border: 0;
  background: transparent;
  color: #84614a;
  border-radius: 5px;
  cursor: pointer;
  display: grid;
  place-items: center;
  font-size: 13px;
  transition: background 0.12s, color 0.12s;
}

.ecu-icon-btn:hover {
  background: rgba(151, 112, 84, 0.18);
  color: #5c4433;
}

.ecu-filter-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 140px;
  overflow-y: auto;
  padding: 4px;
  border: 1px solid #ccb89e;
  border-radius: 6px;
  background: #fffaf4;
}

.ecu-filter-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 6px;
  border-radius: 5px;
  cursor: pointer;
  user-select: none;
  transition: background 0.12s;
  color: #5c4433;
  font-size: 13px;
}

.ecu-filter-item:hover {
  background: rgba(176, 136, 99, 0.12);
}

.ecu-filter-item.selected {
  background: rgba(176, 136, 99, 0.18);
}

.ecu-filter-check {
  width: 16px;
  height: 16px;
  border: 1.5px solid #b89978;
  border-radius: 4px;
  display: grid;
  place-items: center;
  background: #fff;
  flex-shrink: 0;
  transition: background 0.12s, border-color 0.12s;
}

.ecu-filter-check.checked {
  background: #b08863;
  border-color: #967150;
}

.ecu-filter-check-mark {
  color: #fff;
  font-size: 11px;
  line-height: 1;
}

.ecu-filter-item-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ecu-filter-empty {
  padding: 8px;
  text-align: center;
  font-size: 12px;
  color: #a08b78;
}

.ecu-floating-resize-handle {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 14px;
  height: 14px;
  cursor: se-resize;
  background: linear-gradient(135deg, transparent 0%, transparent 50%, #c9b39c 50%, #c9b39c 60%, transparent 60%, transparent 70%, #c9b39c 70%, #c9b39c 80%, transparent 80%);
  border-bottom-right-radius: 10px;
}
</style>