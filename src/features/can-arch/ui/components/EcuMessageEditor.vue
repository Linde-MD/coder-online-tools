<template>
  <div class="ecu-msg-editor" :style="{ height: `${height}px` }" @contextmenu.prevent>
    <div class="ecu-msg-editor-head">
      <button class="ecu-msg-back-icon" type="button" title="返回画布" @click="$emit('close')">
        <span aria-hidden="true">↩</span>
      </button>
      <div class="ecu-msg-title-wrap">
        <div class="ecu-msg-title">{{ ecu?.name || 'ECU' }} 报文编辑</div>
        <div class="ecu-msg-subtitle">按 CAN BUS 分页管理收发报文</div>
      </div>
    </div>

    <div class="ecu-msg-tabs" role="tablist" aria-label="CAN BUS 标签页">
      <button
        v-for="(tab, idx) in busTabs"
        :key="tab.busId"
        class="ecu-msg-tab"
        :class="{ active: activeBusId === tab.busId }"
        type="button"
        role="tab"
        :aria-selected="activeBusId === tab.busId"
        @click="activeBusId = tab.busId"
      >
        <span class="ecu-msg-tab-index">{{ idx + 1 }}</span>
        <span class="ecu-msg-tab-name">{{ tab.busName }}</span>
      </button>
    </div>

    <div v-if="activeTab" class="ecu-msg-filters">
      <div class="ecu-filter-group">
        <div class="ecu-filter-head">
          <span>对端 ECU</span>
          <div class="ecu-filter-actions">
            <button type="button" @click="selectAllPeerFilters">全选</button>
            <button type="button" @click="clearPeerFilters">全不选</button>
          </div>
        </div>
        <select v-model="filterPeerIds" class="form-select form-select-sm" multiple>
          <option v-for="peer in peerOptions" :key="peer.id" :value="peer.id">{{ peer.name }}</option>
        </select>
      </div>

      <div class="ecu-filter-group">
        <div class="ecu-filter-head">
          <span>协议</span>
          <div class="ecu-filter-actions">
            <button type="button" @click="selectAllProtocolFilters">全选</button>
            <button type="button" @click="clearProtocolFilters">全不选</button>
          </div>
        </div>
        <select v-model="filterProtocols" class="form-select form-select-sm" multiple>
          <option v-for="protocol in protocolOptions" :key="protocol.value" :value="protocol.value">{{ protocol.label }}</option>
        </select>
      </div>
    </div>

    <div v-if="!activeTab" class="ecu-msg-empty">当前 ECU 未连接任何 CAN BUS。</div>

    <div v-else class="ecu-msg-body" @pointermove="onSplitPointerMove" @pointerup="onSplitPointerUp" @pointercancel="onSplitPointerUp">
      <button
        v-if="collapsedLeft"
        class="ecu-msg-rail left"
        type="button"
        title="展开接收区"
        @click="collapsedLeft = false"
      >
        ◀ 接收
      </button>

      <section
        v-if="!collapsedLeft"
        class="ecu-msg-pane rx"
        :style="{ width: leftPaneWidth }"
        @contextmenu.prevent="openPaneContextMenu('rx', $event)"
      >
        <div class="ecu-msg-pane-head">
          <strong>接收报文</strong>
          <span class="ecu-msg-count">{{ filteredRxMessages.length }}</span>
          <button class="ecu-msg-collapse" type="button" @click="toggleCollapse('left')">◀ 收起</button>
        </div>

        <div class="ecu-msg-grid-head">
          <span>协议</span>
          <span>名称 / 层级</span>
          <span>ID / 位段</span>
          <span>触发 / 类型</span>
          <span>周期 / 缩放</span>
          <span>DLC / 长度</span>
          <span>发送方</span>
          <span>接收方</span>
        </div>

        <div class="ecu-msg-grid" @contextmenu.prevent="openPaneContextMenu('rx', $event)">
          <div
            v-for="(row, idx) in rxRows"
            :key="row.key"
            class="ecu-msg-grid-row"
            :class="rowClass(row)"
            @click="onRowClick(row, idx, 'rx', $event)"
            @contextmenu.prevent.stop="openRowContextMenu(row, 'rx', $event)"
          >
            <span class="ecu-msg-protocol-badge" :style="{ borderColor: protocolColor(row.protocol), color: protocolColor(row.protocol) }">
              {{ protocolLabel(row.protocol) }}
            </span>
            <span class="ecu-msg-col-name">{{ rowName(row) }}</span>
            <span>{{ rowIdOrBits(row) }}</span>
            <span>{{ rowTypeInfo(row) }}</span>
            <span>{{ rowPeriodOrFactor(row) }}</span>
            <span>{{ rowDlcOrLength(row) }}</span>
            <span>{{ rowSenders(row) }}</span>
            <span>{{ rowReceivers(row) }}</span>
          </div>
        </div>
      </section>

      <div v-if="!collapsedLeft && !collapsedRight" class="ecu-msg-splitter" @pointerdown="onSplitPointerDown"></div>

      <section
        v-if="!collapsedRight"
        class="ecu-msg-pane tx"
        :style="{ flex: collapsedLeft ? '1 1 auto' : '0 0 auto' }"
        @contextmenu.prevent="openPaneContextMenu('tx', $event)"
      >
        <div class="ecu-msg-pane-head">
          <button class="ecu-msg-collapse" type="button" @click="toggleCollapse('right')">收起 ▶</button>
          <strong>发送报文</strong>
          <span class="ecu-msg-count">{{ filteredTxMessages.length }}</span>
        </div>

        <div class="ecu-msg-grid-head">
          <span>协议</span>
          <span>名称 / 层级</span>
          <span>ID / 位段</span>
          <span>触发 / 类型</span>
          <span>周期 / 缩放</span>
          <span>DLC / 长度</span>
          <span>发送方</span>
          <span>接收方</span>
        </div>

        <div class="ecu-msg-grid" @contextmenu.prevent="openPaneContextMenu('tx', $event)">
          <div
            v-for="(row, idx) in txRows"
            :key="row.key"
            class="ecu-msg-grid-row"
            :class="rowClass(row)"
            @click="onRowClick(row, idx, 'tx', $event)"
            @contextmenu.prevent.stop="openRowContextMenu(row, 'tx', $event)"
          >
            <span class="ecu-msg-protocol-badge" :style="{ borderColor: protocolColor(row.protocol), color: protocolColor(row.protocol) }">
              {{ protocolLabel(row.protocol) }}
            </span>
            <span class="ecu-msg-col-name">{{ rowName(row) }}</span>
            <span>{{ rowIdOrBits(row) }}</span>
            <span>{{ rowTypeInfo(row) }}</span>
            <span>{{ rowPeriodOrFactor(row) }}</span>
            <span>{{ rowDlcOrLength(row) }}</span>
            <span>{{ rowSenders(row) }}</span>
            <span>{{ rowReceivers(row) }}</span>
          </div>
        </div>
      </section>

      <button
        v-if="collapsedRight"
        class="ecu-msg-rail right"
        type="button"
        title="展开发送区"
        @click="collapsedRight = false"
      >
        发送 ▶
      </button>

      <aside v-if="selectedEntity" class="ecu-msg-props">
        <div class="ecu-msg-props-title">属性编辑</div>

        <template v-if="selectedEntity.type === 'message'">
          <div class="ecu-prop-grid">
            <label>名称</label>
            <input v-model="selectedEntity.entity.name" class="form-control form-control-sm">

            <label>协议</label>
            <select v-model="selectedEntity.entity.protocol" class="form-select form-select-sm" @change="syncMessageProtocolColor(selectedEntity.entity)">
              <option v-for="protocol in protocolOptions" :key="`m-${protocol.value}`" :value="protocol.value">{{ protocol.label }}</option>
            </select>

            <label>ID</label>
            <input v-model="selectedEntity.entity.idHex" class="form-control form-control-sm" placeholder="0x18FF00AA">

            <label>触发方式</label>
            <select v-model="selectedEntity.entity.triggerMode" class="form-select form-select-sm">
              <option value="cyclic">循环</option>
              <option value="request-response">请求响应</option>
            </select>

            <label>发送模式</label>
            <select v-model="selectedEntity.entity.txMode" class="form-select form-select-sm">
              <option value="periodic">周期</option>
              <option value="event">事件</option>
              <option value="mixed">混合</option>
            </select>

            <label>发送周期(ms)</label>
            <input v-model.number="selectedEntity.entity.periodMs" class="form-control form-control-sm" type="number" min="0">

            <label>字节序</label>
            <select v-model="selectedEntity.entity.byteOrder" class="form-select form-select-sm">
              <option value="intel">Intel</option>
              <option value="motorola">Motorola</option>
            </select>

            <label>DLC</label>
            <input v-model.number="selectedEntity.entity.dlc" class="form-control form-control-sm" type="number" min="0" max="64">

            <label>Layout 页面</label>
            <select v-model="selectedEntity.entity.layoutMode" class="form-select form-select-sm">
              <option value="compact">紧凑布局</option>
              <option value="bit-grid">位布局</option>
            </select>

            <label>发送方</label>
            <select v-model="selectedEntity.entity.senders" class="form-select form-select-sm" multiple>
              <option v-for="opt in participantOptions" :key="`snd-${opt.id}`" :value="opt.id">{{ opt.name }}</option>
            </select>

            <label>接收方</label>
            <select v-model="selectedEntity.entity.receivers" class="form-select form-select-sm" multiple>
              <option v-for="opt in participantOptions" :key="`rcv-${opt.id}`" :value="opt.id">{{ opt.name }}</option>
            </select>
          </div>

          <label class="form-check-label d-flex align-items-center gap-2 mt-2 mb-1">
            <input v-model="selectedEntity.entity.j1939.enabled" class="form-check-input" type="checkbox">J1939 字段
          </label>

          <template v-if="selectedEntity.entity.j1939.enabled">
            <div class="ecu-prop-grid">
              <label>J1939 配置方式</label>
              <select v-model="selectedEntity.entity.j1939.mode" class="form-select form-select-sm">
                <option value="id">直接配置 ID</option>
                <option value="pgn">配置 PGN/Priority/SA/DA</option>
              </select>

              <label>ID</label>
              <input v-model="selectedEntity.entity.j1939.id" class="form-control form-control-sm" placeholder="0x18FEF100">

              <label>PGN</label>
              <input v-model="selectedEntity.entity.j1939.pgn" class="form-control form-control-sm" placeholder="65265">

              <label>Priority</label>
              <input v-model.number="selectedEntity.entity.j1939.priority" class="form-control form-control-sm" type="number" min="0" max="7">

              <label>SA</label>
              <input v-model="selectedEntity.entity.j1939.sa" class="form-control form-control-sm" placeholder="源地址">

              <label>DA</label>
              <input v-model="selectedEntity.entity.j1939.da" class="form-control form-control-sm" placeholder="目的地址">
            </div>
          </template>

          <label class="mt-2 mb-1">注释</label>
          <textarea v-model="selectedEntity.entity.comment" class="form-control form-control-sm" rows="2"></textarea>
        </template>

        <template v-else>
          <div class="ecu-prop-grid">
            <label>Signal 名称</label>
            <input v-model="selectedEntity.entity.name" class="form-control form-control-sm">

            <label>起始位</label>
            <input v-model.number="selectedEntity.entity.startBit" class="form-control form-control-sm" type="number" min="0">

            <label>长度(bit)</label>
            <input v-model.number="selectedEntity.entity.length" class="form-control form-control-sm" type="number" min="1">

            <label>Factor</label>
            <input v-model.number="selectedEntity.entity.factor" class="form-control form-control-sm" type="number" step="any">

            <label>Offset</label>
            <input v-model.number="selectedEntity.entity.offset" class="form-control form-control-sm" type="number" step="any">

            <label>Signed</label>
            <label class="form-check-label d-flex align-items-center gap-2">
              <input v-model="selectedEntity.entity.signed" class="form-check-input" type="checkbox">有符号
            </label>

            <label>单位</label>
            <input v-model="selectedEntity.entity.unit" class="form-control form-control-sm">
          </div>

          <label class="mt-2 mb-1">注释</label>
          <textarea v-model="selectedEntity.entity.comment" class="form-control form-control-sm" rows="2"></textarea>
        </template>
      </aside>
    </div>

    <div v-if="contextMenu.open" class="ecu-msg-context" :style="{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }" @click.stop>
      <button v-if="contextMenu.target === 'pane'" class="ecu-msg-context-item" type="button" @click="addMessageAtPane(contextMenu.pane)">新增 Message</button>
      <button v-if="contextMenu.target === 'pane'" class="ecu-msg-context-item" type="button" @click="pasteAt(contextMenu.pane)">粘贴</button>
      <button v-if="contextMenu.target === 'message'" class="ecu-msg-context-item" type="button" @click="addSignalToContextMessage">在此 Message 下新增 Signal</button>
      <button v-if="contextMenu.target !== 'pane'" class="ecu-msg-context-item" type="button" @click="copySelection">复制</button>
      <button v-if="contextMenu.target !== 'pane'" class="ecu-msg-context-item" type="button" @click="cutSelection">剪切</button>
      <button v-if="contextMenu.target !== 'pane'" class="ecu-msg-context-item danger" type="button" @click="deleteSelection">删除</button>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, toRef } from 'vue';
import { useEcuMessageWorkspace } from '@/features/can-arch/app/composables/useEcuMessageWorkspace.js';
import { useEcuMessageSelection } from '@/features/can-arch/app/composables/useEcuMessageSelection.js';
import { useEcuMessageCommands } from '@/features/can-arch/app/composables/useEcuMessageCommands.js';

const props = defineProps({
  ecu: {
    type: Object,
    required: true,
  },
  busTabs: {
    type: Array,
    default: () => [],
  },
  height: {
    type: Number,
    default: 620,
  },
});

defineEmits(['close']);

const ecuRef = toRef(props, 'ecu');
const busTabsRef = toRef(props, 'busTabs');

const {
  protocolOptions,
  activeBusId,
  activeTab,
  peerOptions,
  protocolValues,
  filterPeerIds,
  filterProtocols,
  rxMessages,
  txMessages,
  filteredRxMessages,
  filteredTxMessages,
  rxRows,
  txRows,
  getRowsByPane,
  addMessage,
  addSignalToMessage,
  syncMessageProtocolColor,
  protocolColor,
  selectAllPeerFilters,
  clearPeerFilters,
  selectAllProtocolFilters,
  clearProtocolFilters,
} = useEcuMessageWorkspace({
  ecuRef,
  busTabsRef,
});

const {
  selectedPane,
  selectedKeys,
  selectedEntity,
  clearSelection,
  ensureSelected,
  onRowClick,
} = useEcuMessageSelection({
  getRowsByPane,
});

const {
  contextMenu,
  closeContextMenu,
  openPaneContextMenu,
  openRowContextMenu,
  addMessageAtPane,
  addSignalToContextMessage,
  deleteSelection,
  copySelection,
  cutSelection,
  pasteAt,
} = useEcuMessageCommands({
  activeTab,
  rxMessages,
  txMessages,
  getRowsByPane,
  selectedPane,
  selectedKeys,
  clearSelection,
  ensureSelected,
  addMessage,
  addSignalToMessage,
});

const splitRatio = ref(0.5);
const collapsedLeft = ref(false);
const collapsedRight = ref(false);
const splitDrag = ref(null);

const leftPaneWidth = computed(() => {
  if (collapsedRight.value) return '100%';
  return `${Math.max(20, Math.min(80, splitRatio.value * 100))}%`;
});

const participantOptions = computed(() => {
  const ecu = ecuRef.value;
  const peers = peerOptions.value || [];
  const options = [{ id: ecu.id, name: `${ecu.name} (当前)` }];
  for (const peer of peers) {
    options.push({ id: peer.id, name: peer.name });
  }
  return options;
});

function protocolLabel(protocol) {
  const found = protocolOptions.find((item) => item.value === protocol);
  return found?.label || protocol;
}

function resolveNodeName(nodeId) {
  const found = participantOptions.value.find((item) => item.id === nodeId);
  return found?.name || nodeId;
}

function rowClass(row) {
  return {
    selected: selectedKeys.value.includes(row.key),
    signal: row.type === 'signal',
    message: row.type === 'message',
  };
}

function rowName(row) {
  if (row.type === 'message') return row.message.name;
  return `Signal: ${row.signal.name}`;
}

function rowIdOrBits(row) {
  if (row.type === 'message') return row.message.idHex || '-';
  return `bit ${row.signal.startBit} / ${row.signal.length}`;
}

function rowTypeInfo(row) {
  if (row.type === 'message') {
    const trigger = row.message.triggerMode === 'request-response' ? '请求响应' : '循环';
    return `${trigger} / ${row.message.byteOrder || '-'}`;
  }
  return row.signal.signed ? 'Signed' : 'Unsigned';
}

function rowPeriodOrFactor(row) {
  if (row.type === 'message') return `${row.message.periodMs || 0} ms`;
  return `F:${row.signal.factor} O:${row.signal.offset}`;
}

function rowDlcOrLength(row) {
  if (row.type === 'message') return `DLC ${row.message.dlc || 0}`;
  return `${row.signal.length} bit`;
}

function rowSenders(row) {
  const list = row.message?.senders || [];
  if (list.length === 0) return '-';
  return list.map(resolveNodeName).join(', ');
}

function rowReceivers(row) {
  const list = row.message?.receivers || [];
  if (list.length === 0) return '-';
  return list.map(resolveNodeName).join(', ');
}

function onSplitPointerDown(event) {
  splitDrag.value = {
    startX: event.clientX,
    startRatio: splitRatio.value,
  };
}

function onSplitPointerMove(event) {
  if (!splitDrag.value) return;
  const host = event.currentTarget;
  const width = host?.clientWidth || 1;
  const dx = event.clientX - splitDrag.value.startX;
  splitRatio.value = Math.max(0.2, Math.min(0.8, splitDrag.value.startRatio + dx / width));
}

function onSplitPointerUp() {
  splitDrag.value = null;
}

function toggleCollapse(side) {
  if (side === 'left') {
    collapsedLeft.value = true;
    collapsedRight.value = false;
    return;
  }
  collapsedRight.value = true;
  collapsedLeft.value = false;
}

function handleWindowKeydown(event) {
  const tag = String(event.target?.tagName || '').toLowerCase();
  const editable = tag === 'input' || tag === 'textarea' || event.target?.isContentEditable;
  if (editable) return;

  if (event.key === 'Delete') {
    event.preventDefault();
    deleteSelection();
    return;
  }

  const ctrl = event.ctrlKey || event.metaKey;
  if (!ctrl) return;
  const key = String(event.key || '').toLowerCase();
  if (key === 'c') {
    event.preventDefault();
    copySelection();
    return;
  }
  if (key === 'x') {
    event.preventDefault();
    cutSelection();
    return;
  }
  if (key === 'v') {
    event.preventDefault();
    pasteAt();
    return;
  }
  if (key === 'a') {
    event.preventDefault();
    if (selectedPane.value === 'rx') {
      selectedKeys.value = rxRows.value.map((item) => item.key);
    } else {
      selectedKeys.value = txRows.value.map((item) => item.key);
    }
  }
}

function handleWindowPointerDown(event) {
  if (event.target?.closest?.('.ecu-msg-context')) return;
  closeContextMenu();
}

onMounted(() => {
  window.addEventListener('keydown', handleWindowKeydown);
  window.addEventListener('pointerdown', handleWindowPointerDown);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleWindowKeydown);
  window.removeEventListener('pointerdown', handleWindowPointerDown);
});

defineExpose({
  deleteSelection,
  copySelection,
  cutSelection,
  pasteAt,
  addMessageAtPane,
  get hasSelection() {
    return Array.isArray(selectedKeys.value) && selectedKeys.value.length > 0;
  },
  get selectedKeys() {
    return selectedKeys.value;
  },
});
</script>

<style scoped>
.ecu-msg-editor {
  position: relative;
  display: grid;
  grid-template-rows: auto auto 1fr;
  gap: 8px;
  padding: 10px;
  background: linear-gradient(180deg, #f8f2ea 0%, #f4ebe1 100%);
  border-radius: 10px;
  border: 1px solid #dbc8b6;
}

.ecu-msg-editor-head {
  display: flex;
  align-items: center;
  gap: 10px;
}

.ecu-msg-back-icon {
  width: 30px;
  height: 30px;
  border: 0;
  background: rgba(151, 112, 84, 0.14);
  color: #6c4d36;
  border-radius: 7px;
}

.ecu-msg-back-icon:hover {
  background: rgba(151, 112, 84, 0.26);
}

.ecu-msg-title-wrap {
  min-width: 0;
}

.ecu-msg-title {
  font-weight: 700;
  color: #5c4535;
}

.ecu-msg-subtitle {
  font-size: 12px;
  color: #8a7460;
}

.ecu-msg-tabs {
  display: flex;
  gap: 6px;
  align-items: stretch;
  border: 1px solid #dbc6b2;
  border-radius: 10px;
  padding: 6px;
  background: rgba(255, 248, 239, 0.88);
}

.ecu-msg-tab {
  border: 1px solid #d8bfa8;
  background: #f9efe3;
  color: #5c4433;
  border-radius: 8px;
  padding: 6px 10px;
  min-width: 120px;
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 8px;
  align-items: center;
}

.ecu-msg-tab-index {
  width: 18px;
  height: 18px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  border: 1px solid #caa688;
  font-size: 11px;
}

.ecu-msg-tab-name {
  text-align: left;
  font-weight: 600;
}

.ecu-msg-tab.active {
  background: #eed9c5;
  border-color: #ba8f6e;
  box-shadow: inset 0 -2px 0 #9e7458;
}

.ecu-msg-filters {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 280px;
  z-index: 4;
  background: rgba(255, 252, 248, 0.95);
  border: 1px solid #dcc9b6;
  border-radius: 8px;
  padding: 8px;
  display: grid;
  gap: 8px;
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
}

.ecu-filter-actions {
  display: inline-flex;
  gap: 6px;
}

.ecu-filter-actions button {
  border: 0;
  background: transparent;
  color: #84614a;
  font-size: 11px;
  padding: 0;
}

.ecu-msg-empty {
  display: grid;
  place-items: center;
  color: #7f6a56;
  border: 1px dashed #d9c6b2;
  border-radius: 8px;
}

.ecu-msg-body {
  position: relative;
  display: flex;
  min-height: 0;
  border: 1px solid #decbbc;
  border-radius: 8px;
  overflow: hidden;
  background: #fffaf4;
}

.ecu-msg-rail {
  flex: 0 0 34px;
  border: 0;
  background: linear-gradient(180deg, #efe0d0 0%, #e7d3bf 100%);
  color: #654c38;
  writing-mode: vertical-rl;
  text-orientation: mixed;
  font-size: 12px;
}

.ecu-msg-pane {
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: rgba(255, 255, 255, 0.66);
}

.ecu-msg-pane-head {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: space-between;
  padding: 6px 8px;
  border-bottom: 1px solid #e5d4c5;
  color: #5e4a3a;
}

.ecu-msg-count {
  font-size: 12px;
  color: #887461;
  margin-left: auto;
}

.ecu-msg-collapse {
  border: 0;
  background: transparent;
  color: #7b6551;
  font-size: 12px;
}

.ecu-msg-grid-head,
.ecu-msg-grid-row {
  display: grid;
  grid-template-columns: 96px minmax(140px, 1.4fr) minmax(95px, 1fr) minmax(90px, 1fr) minmax(90px, 1fr) minmax(85px, 0.9fr) minmax(120px, 1.1fr) minmax(120px, 1.1fr);
  gap: 6px;
  align-items: center;
}

.ecu-msg-grid-head {
  padding: 6px 8px;
  font-size: 11px;
  color: #7a614d;
  border-bottom: 1px solid #eadbcf;
  background: #f9efe4;
}

.ecu-msg-grid {
  overflow: auto;
  padding: 6px;
  display: grid;
  gap: 4px;
}

.ecu-msg-grid-row {
  padding: 6px;
  border-radius: 6px;
  border: 1px solid transparent;
  font-size: 12px;
}

.ecu-msg-grid-row.message {
  background: rgba(254, 246, 236, 0.7);
}

.ecu-msg-grid-row.signal {
  background: rgba(249, 240, 229, 0.62);
  margin-left: 18px;
}

.ecu-msg-grid-row:hover {
  background: rgba(183, 150, 124, 0.13);
}

.ecu-msg-grid-row.selected {
  border-color: #bf8f6a;
  background: rgba(225, 187, 155, 0.28);
}

.ecu-msg-grid-row > span {
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ecu-msg-col-name {
  font-weight: 600;
}

.ecu-msg-protocol-badge {
  border: 1px solid;
  border-radius: 999px;
  padding: 1px 8px;
  font-size: 11px;
  text-align: center;
  background: rgba(255, 255, 255, 0.62);
}

.ecu-msg-splitter {
  width: 8px;
  cursor: col-resize;
  background: linear-gradient(180deg, #ead8c7 0%, #dfc7b1 100%);
}

.ecu-msg-props {
  position: absolute;
  right: 12px;
  bottom: 12px;
  width: 300px;
  max-height: calc(100% - 98px);
  overflow: auto;
  border: 1px solid #dac7b5;
  border-radius: 8px;
  background: rgba(255, 252, 247, 0.96);
  padding: 8px;
  z-index: 3;
}

.ecu-msg-props-title {
  font-weight: 700;
  color: #5a4432;
  margin-bottom: 6px;
}

.ecu-prop-grid {
  display: grid;
  grid-template-columns: 96px 1fr;
  gap: 6px;
  align-items: center;
}

.ecu-prop-grid label {
  font-size: 12px;
  color: #6d5745;
}

.ecu-msg-context {
  position: fixed;
  z-index: 80;
  min-width: 180px;
  border: 1px solid #d6c2ae;
  border-radius: 8px;
  background: #fff8f0;
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.18);
  padding: 4px;
}

.ecu-msg-context-item {
  width: 100%;
  text-align: left;
  border: 0;
  background: transparent;
  color: #503d2e;
  border-radius: 6px;
  padding: 6px 8px;
}

.ecu-msg-context-item:hover {
  background: rgba(188, 150, 120, 0.2);
}

.ecu-msg-context-item.danger {
  color: #9b3025;
}

@media (max-width: 1240px) {
  .ecu-msg-filters {
    position: static;
    width: 100%;
  }

  .ecu-msg-editor {
    grid-template-rows: auto auto auto 1fr;
  }

  .ecu-msg-grid-head,
  .ecu-msg-grid-row {
    grid-template-columns: 88px minmax(120px, 1.2fr) minmax(84px, 1fr) minmax(84px, 1fr) minmax(84px, 1fr) minmax(76px, 0.9fr) minmax(96px, 1fr) minmax(96px, 1fr);
  }
}
</style>