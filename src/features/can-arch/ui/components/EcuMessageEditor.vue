<template>
  <div class="ecu-msg-editor" ref="editorRef" :style="{ height: `${height || 620}px`, minHeight: '400px' }" @contextmenu.prevent>
    <div class="ecu-msg-editor-head">
      <button class="ecu-msg-back-icon" type="button" title="返回画布" @click="$emit('close')">
        <span aria-hidden="true">↩</span>
      </button>
      <div class="ecu-msg-ecu-switch">
        <select
          class="ecu-msg-ecu-select"
          :value="ecu?.id"
          @change="(e) => onEcuSwitch(e.target.value)"
        >
          <option v-for="n in ecuNodes" :key="n.id" :value="n.id">{{ n.name }}</option>
        </select>
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
      <button
        v-if="activeTab"
        class="ecu-msg-filter-toggle"
        type="button"
        :title="filterPanelOpen ? '隐藏过滤器' : '显示过滤器'"
        @click="filterPanelOpen = !filterPanelOpen"
      >
        <span aria-hidden="true">⚙</span>
      </button>
    </div>

    <EcuMessageFilterPanel
      v-if="activeTab"
      v-show="filterPanelOpen"
      :peer-options="peerOptions"
      :protocol-options="protocolOptions"
      :filter-peer-ids="filterPeerIds"
      :filter-protocols="filterProtocols"
      :boundary-ref="editorRef"
      @update:filter-peer-ids="(val) => (filterPeerIds = val)"
      @update:filter-protocols="(val) => (filterProtocols = val)"
      @close="filterPanelOpen = false"
    />

    <div v-if="!activeTab" class="ecu-msg-empty">当前 ECU 未连接任何 CAN BUS。</div>

    <div v-else class="ecu-msg-main">
      <div class="ecu-msg-body" :style="bodyStyle">
      <button
        v-if="collapsedLeft"
        class="ecu-msg-rail left"
        type="button"
        title="展开接收区"
        @click="collapsedLeft = false"
      >
        ▶ 接收报文
      </button>

      <section
        v-if="!collapsedLeft"
        class="ecu-msg-pane rx"
        :style="{ flex: `0 0 ${leftPaneWidth}` }"
        @contextmenu.prevent="openPaneContextMenu('rx', $event)"
      >
        <div class="ecu-msg-pane-head">
          <strong>接收报文</strong>
          <span class="ecu-msg-count">共 {{ filteredRxMessages.length }} 条</span>
          <div class="ecu-msg-sort-bar">
            <span class="ecu-msg-sort-label">排序</span>
            <span
              v-for="key in sortKeys"
              :key="key"
              class="ecu-msg-sort-chip"
              :class="{ 'sort-drag-over': sortDragOverKey === key }"
              draggable="true"
              @dragstart="onSortDragStart($event, key)"
              @dragend="onSortDragEnd"
              @dragover.prevent="onSortDragOver($event, key)"
              @dragenter.prevent
              @dragleave="onSortDragLeave"
              @drop="onSortDrop($event, key)"
            >{{ SORT_KEY_LABELS[key] }}</span>
          </div>
          <button class="ecu-msg-collapse" type="button" title="收起接收区" @click="toggleCollapse('left')">◀</button>
        </div>

        <div class="ecu-msg-cards" @contextmenu.prevent="openPaneContextMenu('rx', $event)" @click.self="clearSelection">
          <div
            v-for="message in sortedRxMessages"
            :key="message.id"
            class="ecu-msg-card"
            :class="{ selected: isMessageSelected('rx', message.id), 'has-error': messageErrors.has(message.id) }"
            :style="cardStyle(message)"
            :title="messageErrors.has(message.id) ? messageErrors.get(message.id).messages.join('；') : ''"
            @click.stop="onCardClick('rx', message, $event)"
            @contextmenu.prevent.stop="onCardContextMenu('rx', message, $event)"
          >
            <div
              class="ecu-msg-card-head"
              :style="cardHeadStyle(message)"
            >
              <div class="ecu-msg-card-id-row">
                <span class="ecu-msg-card-id">{{ message.idHex }}</span>
                <span
                  v-for="peer in getMessagePeers(message, 'rx')"
                  :key="peer.id"
                  class="ecu-msg-peer-tag"
                  :style="{ color: peer.color }"
                >{{ peer.name }}</span>
              </div>
              <span class="ecu-msg-card-name">{{ message.name }}</span>
            </div>
            <div class="ecu-msg-card-body">
              <div
                v-for="signal in sortedSignals(message)"
                :key="signal.id"
                class="ecu-msg-card-signal"
                :class="{ selected: isSignalSelected('rx', message.id, signal.id) }"
                @click.stop="onSignalClickInCard('rx', message, signal, $event)"
                @contextmenu.prevent.stop="onSignalContextMenuInCard('rx', message, signal, $event)"
              >
                <span class="ecu-msg-signal-name">{{ signal.name }}</span>
                <span class="ecu-msg-signal-len">{{ signal.length }} bit</span>
              </div>
              <div v-if="!message.signals || message.signals.length === 0" class="ecu-msg-card-empty">
                暂无 Signal
              </div>
            </div>
          </div>
        </div>
      </section>

      <div v-if="!collapsedLeft && !collapsedRight" class="ecu-msg-splitter" @pointerdown="onSplitPointerDown"></div>

      <section
        v-if="!collapsedRight"
        class="ecu-msg-pane tx"
        :style="{ flex: '1 1 0%', minWidth: 0 }"
        @contextmenu.prevent="openPaneContextMenu('tx', $event)"
      >
        <div class="ecu-msg-pane-head">
          <button class="ecu-msg-collapse" type="button" title="收起发送区" @click="toggleCollapse('right')">▶</button>
          <strong>发送报文</strong>
          <span class="ecu-msg-count">共 {{ filteredTxMessages.length }} 条</span>
          <div class="ecu-msg-sort-bar">
            <span class="ecu-msg-sort-label">排序</span>
            <span
              v-for="key in sortKeys"
              :key="key"
              class="ecu-msg-sort-chip"
              :class="{ 'sort-drag-over': sortDragOverKey === key }"
              draggable="true"
              @dragstart="onSortDragStart($event, key)"
              @dragend="onSortDragEnd"
              @dragover.prevent="onSortDragOver($event, key)"
              @dragenter.prevent
              @dragleave="onSortDragLeave"
              @drop="onSortDrop($event, key)"
            >{{ SORT_KEY_LABELS[key] }}</span>
          </div>
        </div>

        <div class="ecu-msg-cards" @contextmenu.prevent="openPaneContextMenu('tx', $event)" @click.self="clearSelection">
          <div
            v-for="message in sortedTxMessages"
            :key="message.id"
            class="ecu-msg-card"
            :class="{ selected: isMessageSelected('tx', message.id), 'has-error': messageErrors.has(message.id) }"
            :style="cardStyle(message)"
            :title="messageErrors.has(message.id) ? messageErrors.get(message.id).messages.join('；') : ''"
            @click.stop="onCardClick('tx', message, $event)"
            @contextmenu.prevent.stop="onCardContextMenu('tx', message, $event)"
          >
            <div
              class="ecu-msg-card-head"
              :style="cardHeadStyle(message)"
            >
              <div class="ecu-msg-card-id-row">
                <span class="ecu-msg-card-id">{{ message.idHex }}</span>
                <span
                  v-for="peer in getMessagePeers(message, 'tx')"
                  :key="peer.id"
                  class="ecu-msg-peer-tag"
                  :style="{ color: peer.color }"
                >{{ peer.name }}</span>
              </div>
              <span class="ecu-msg-card-name">{{ message.name }}</span>
            </div>
            <div class="ecu-msg-card-body">
              <div
                v-for="signal in sortedSignals(message)"
                :key="signal.id"
                class="ecu-msg-card-signal"
                :class="{ selected: isSignalSelected('tx', message.id, signal.id) }"
                @click.stop="onSignalClickInCard('tx', message, signal, $event)"
                @contextmenu.prevent.stop="onSignalContextMenuInCard('tx', message, signal, $event)"
              >
                <span class="ecu-msg-signal-name">{{ signal.name }}</span>
                <span class="ecu-msg-signal-len">{{ signal.length }} bit</span>
              </div>
              <div v-if="!message.signals || message.signals.length === 0" class="ecu-msg-card-empty">
                暂无 Signal
              </div>
            </div>
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
        ◀ 发送报文
      </button>

      </div>

    <div v-if="showPropsPanel" class="ecu-msg-props-splitter" @pointerdown="onPropsSplitPointerDown"></div>
    <aside v-if="showPropsPanel" class="ecu-msg-props" :style="propsPanelStyle">
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

    <div v-if="contextMenu.open" class="ecu-msg-context" :style="{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }" @click.stop>
      <button v-if="contextMenu.target === 'pane'" class="ecu-msg-context-item" type="button" @click="addMessageAtPane(contextMenu.pane)">新增 Message</button>
      <button v-if="contextMenu.target === 'pane'" class="ecu-msg-context-item" type="button" @click="pasteAt(contextMenu.pane)">粘贴</button>
      <button v-if="contextMenu.target === 'message'" class="ecu-msg-context-item" type="button" @click="addSignalToContextMessage">在此 Message 下新增 Signal</button>
      <button v-if="contextMenu.target !== 'pane'" class="ecu-msg-context-item" type="button" @click="copySelection">复制</button>
      <button v-if="contextMenu.target !== 'pane'" class="ecu-msg-context-item danger" type="button" @click="deleteSelection">删除</button>
    </div>
  </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, toRef, watch } from 'vue';
import { useEcuMessageWorkspace } from '@/features/can-arch/app/composables/useEcuMessageWorkspace.js';
import { useEcuMessageSelection } from '@/features/can-arch/app/composables/useEcuMessageSelection.js';
import { useEcuMessageCommands } from '@/features/can-arch/app/composables/useEcuMessageCommands.js';
import EcuMessageFilterPanel from './EcuMessageFilterPanel.vue';
import { filterPanelPositionCache, saveFilterPanelOpen } from '@/features/can-arch/app/composables/useFilterPanelCache.js';

const propsPanelWidthCache = { width: 300 };

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
  ecuNodes: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits(['close', 'switch-ecu']);

function onEcuSwitch(ecuId) {
  if (!ecuId || ecuId === props.ecu?.id) return;
  emit('switch-ecu', ecuId);
}

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
  messageErrors,
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
  peerOptions,
  currentEcuId: computed(() => props.ecu?.id || ''),
});

const splitRatio = ref(0.5);

const SORT_KEY_LABELS = {
  protocol: '协议',
  peer: '对端ECU',
  idHex: 'ID',
  name: '报文名',
};

const sortKeys = ref(['protocol', 'peer', 'idHex', 'name']);

function getPeerNameForSort(message, pane) {
  const peerIds = pane === 'rx'
    ? (Array.isArray(message.senders) ? message.senders : [])
    : (Array.isArray(message.receivers) ? message.receivers : []);
  if (peerIds.length === 0) return '';
  const firstPeer = props.ecuNodes.find((n) => n.id === peerIds[0]);
  return firstPeer?.name || peerIds[0] || '';
}

function getSortValue(message, pane, key) {
  switch (key) {
    case 'protocol': return message.protocol || '';
    case 'peer': return getPeerNameForSort(message, pane);
    case 'idHex': return parseInt(message.idHex || '0', 16);
    case 'name': return message.name || '';
    default: return '';
  }
}

function sortMessagesByKeys(messages, pane) {
  return [...messages].sort((a, b) => {
    for (const key of sortKeys.value) {
      const va = getSortValue(a, pane, key);
      const vb = getSortValue(b, pane, key);
      if (va < vb) return -1;
      if (va > vb) return 1;
    }
    return 0;
  });
}

const sortedRxMessages = computed(() => sortMessagesByKeys(filteredRxMessages.value, 'rx'));
const sortedTxMessages = computed(() => sortMessagesByKeys(filteredTxMessages.value, 'tx'));

let sortDragKey = null;
const sortDragOverKey = ref(null);

function onSortDragStart(event, key) {
  sortDragKey = key;
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', key);
}

function onSortDragEnd() {
  sortDragKey = null;
  sortDragOverKey.value = null;
}

function onSortDragOver(event, key) {
  event.dataTransfer.dropEffect = 'move';
  sortDragOverKey.value = key;
}

function onSortDragLeave() {
  sortDragOverKey.value = null;
}

function onSortDrop(event, targetKey) {
  sortDragOverKey.value = null;
  if (!sortDragKey || sortDragKey === targetKey) return;
  const keys = [...sortKeys.value];
  const fromIdx = keys.indexOf(sortDragKey);
  const toIdx = keys.indexOf(targetKey);
  if (fromIdx < 0 || toIdx < 0) return;
  keys.splice(fromIdx, 1);
  keys.splice(toIdx, 0, sortDragKey);
  sortKeys.value = keys;
  sortDragKey = null;
}

const collapsedLeft = ref(false);
const collapsedRight = ref(false);
const splitDrag = ref(null);
const editorRef = ref(null);
const filterPanelOpen = ref(filterPanelPositionCache.open);

const propsPanelWidth = ref(propsPanelWidthCache.width);
const propsPanelDrag = ref(null);

const showPropsPanel = computed(() => {
  return selectedKeys.value.length === 1 && selectedEntity.value;
});

const bodyStyle = computed(() => {
  if (!showPropsPanel.value) return {};
  return { flex: '1 1 0%', minWidth: 0 };
});

const propsPanelStyle = computed(() => {
  return { width: `${propsPanelWidth.value}px`, flexShrink: 0 };
});

watch(filterPanelOpen, (val) => {
  saveFilterPanelOpen(val);
});

const leftPaneWidth = computed(() => {
  if (collapsedRight.value) return '100%';
  return `${Math.max(5, Math.min(95, splitRatio.value * 100))}%`;
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

function sortedSignals(message) {
  const signals = message?.signals || [];
  return [...signals].sort((a, b) => (a.startBit ?? 0) - (b.startBit ?? 0));
}

function buildMessageKey(pane, messageId) {
  return `${pane}|m|${messageId}`;
}

function buildSignalKey(pane, messageId, signalId) {
  return `${pane}|s|${messageId}|${signalId}`;
}

function isMessageSelected(pane, messageId) {
  return selectedKeys.value.includes(buildMessageKey(pane, messageId));
}

function isSignalSelected(pane, messageId, signalId) {
  return selectedKeys.value.includes(buildSignalKey(pane, messageId, signalId));
}

function findRowIndexByKey(key) {
  const pane = key.startsWith('rx|') ? 'rx' : 'tx';
  const rows = getRowsByPane(pane);
  return rows.findIndex((r) => r.key === key);
}

function onCardClick(pane, message, event) {
  const key = buildMessageKey(pane, message.id);
  const idx = findRowIndexByKey(key);
  if (idx < 0) return;
  const rows = getRowsByPane(pane);
  onRowClick(rows[idx], idx, pane, event);
}

function onCardContextMenu(pane, message, event) {
  const key = buildMessageKey(pane, message.id);
  const idx = findRowIndexByKey(key);
  if (idx < 0) return;
  const rows = getRowsByPane(pane);
  openRowContextMenu(rows[idx], pane, event);
}

function onSignalClickInCard(pane, message, signal, event) {
  const key = buildSignalKey(pane, message.id, signal.id);
  const idx = findRowIndexByKey(key);
  if (idx < 0) return;
  const rows = getRowsByPane(pane);
  onRowClick(rows[idx], idx, pane, event);
}

function onSignalContextMenuInCard(pane, message, signal, event) {
  const key = buildSignalKey(pane, message.id, signal.id);
  const idx = findRowIndexByKey(key);
  if (idx < 0) return;
  const rows = getRowsByPane(pane);
  openRowContextMenu(rows[idx], pane, event);
}

function getMessagePeers(message, pane) {
  const peerIds = pane === 'rx'
    ? (Array.isArray(message.senders) ? message.senders : [])
    : (Array.isArray(message.receivers) ? message.receivers : []);
  const ecuId = props.ecu?.id;
  return peerIds
    .filter((id) => id !== ecuId)
    .map((id) => {
      const node = props.ecuNodes.find((n) => n.id === id);
      return {
        id,
        name: node?.name || id,
        color: node?.baseColor || '#888',
      };
    });
}

function cardStyle(message) {
  const color = message?.color || protocolColor(message?.protocol);
  return {
    borderColor: color,
    '--card-color': color,
  };
}

function cardHeadStyle(message) {
  const color = message?.color || protocolColor(message?.protocol);
  return {
    backgroundColor: color,
  };
}

function onSplitPointerDown(event) {
  event.preventDefault();
  splitDrag.value = {
    startX: event.clientX,
    startRatio: splitRatio.value,
  };
  document.addEventListener('pointermove', onSplitPointerMove);
  document.addEventListener('pointerup', onSplitPointerUp);
  document.addEventListener('pointercancel', onSplitPointerUp);
}

function onSplitPointerMove(event) {
  if (!splitDrag.value) return;
  const body = editorRef.value?.querySelector('.ecu-msg-body');
  const width = body?.clientWidth || 1;
  const dx = event.clientX - splitDrag.value.startX;
  splitRatio.value = Math.max(0.05, Math.min(0.95, splitDrag.value.startRatio + dx / width));
}

function onSplitPointerUp() {
  splitDrag.value = null;
  document.removeEventListener('pointermove', onSplitPointerMove);
  document.removeEventListener('pointerup', onSplitPointerUp);
  document.removeEventListener('pointercancel', onSplitPointerUp);
}

function onPropsSplitPointerDown(event) {
  event.preventDefault();
  propsPanelDrag.value = {
    startX: event.clientX,
    startWidth: propsPanelWidth.value,
  };
  document.addEventListener('pointermove', onPropsSplitPointerMove);
  document.addEventListener('pointerup', onPropsSplitPointerUp);
  document.addEventListener('pointercancel', onPropsSplitPointerUp);
}

function onPropsSplitPointerMove(event) {
  if (!propsPanelDrag.value) return;
  const dx = propsPanelDrag.value.startX - event.clientX;
  const newWidth = propsPanelDrag.value.startWidth + dx;
  propsPanelWidth.value = Math.max(200, Math.min(500, newWidth));
  propsPanelWidthCache.width = propsPanelWidth.value;
}

function onPropsSplitPointerUp() {
  propsPanelDrag.value = null;
  document.removeEventListener('pointermove', onPropsSplitPointerMove);
  document.removeEventListener('pointerup', onPropsSplitPointerUp);
  document.removeEventListener('pointercancel', onPropsSplitPointerUp);
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

  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    deleteSelection();
    return;
  }

  if (event.key === 'Escape') {
    clearSelection();
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
  document.removeEventListener('pointermove', onSplitPointerMove);
  document.removeEventListener('pointerup', onSplitPointerUp);
  document.removeEventListener('pointercancel', onSplitPointerUp);
  document.removeEventListener('pointermove', onPropsSplitPointerMove);
  document.removeEventListener('pointerup', onPropsSplitPointerUp);
  document.removeEventListener('pointercancel', onPropsSplitPointerUp);
});

defineExpose({
  deleteSelection,
  copySelection,
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
  display: flex;
  flex-direction: column;
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
  flex-shrink: 0;
}

.ecu-msg-back-icon:hover {
  background: rgba(151, 112, 84, 0.26);
}

.ecu-msg-ecu-switch {
  display: flex;
  align-items: center;
  gap: 4px;
}

.ecu-msg-ecu-select {
  border: 1px solid #caa688;
  background: #fffaf4;
  color: #5c4433;
  border-radius: 7px;
  padding: 6px 10px;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  outline: none;
  transition: border-color 0.12s, box-shadow 0.12s;
  max-width: 180px;
}

.ecu-msg-ecu-select:hover {
  border-color: #b08863;
  box-shadow: 0 1px 4px rgba(151, 112, 84, 0.2);
}

.ecu-msg-ecu-select:focus {
  border-color: #b08863;
  box-shadow: 0 0 0 2px rgba(176, 136, 99, 0.25);
}

.ecu-msg-tabs {
  display: flex;
  gap: 6px;
  align-items: center;
  flex: 1;
  min-width: 0;
}

.ecu-msg-tab {
  border: 1px solid transparent;
  background: transparent;
  color: #7a614d;
  border-radius: 7px;
  padding: 6px 10px;
  min-width: 120px;
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 8px;
  align-items: center;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}

.ecu-msg-tab:hover {
  background: rgba(151, 112, 84, 0.18);
  color: #5c4433;
  border-color: rgba(151, 112, 84, 0.3);
}

.ecu-msg-tab-index {
  width: 18px;
  height: 18px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  border: 1px solid #caa688;
  font-size: 11px;
  background: rgba(255, 255, 255, 0.6);
}

.ecu-msg-tab-name {
  text-align: left;
  font-weight: 600;
}

.ecu-msg-tab.active {
  background: #fff;
  color: #5c4433;
  border-color: #b08863;
  box-shadow: 0 2px 6px rgba(151, 112, 84, 0.25);
}

.ecu-msg-tab.active .ecu-msg-tab-index {
  background: #b08863;
  color: #fff;
  border-color: #967150;
}

.ecu-msg-filter-toggle {
  width: 30px;
  height: 30px;
  border: 1px solid transparent;
  background: rgba(151, 112, 84, 0.14);
  color: #6c4d36;
  border-radius: 7px;
  display: grid;
  place-items: center;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.12s, border-color 0.12s;
}

.ecu-msg-filter-toggle:hover {
  background: rgba(151, 112, 84, 0.26);
  border-color: rgba(151, 112, 84, 0.3);
}

.ecu-msg-empty {
  display: grid;
  place-items: center;
  color: #7f6a56;
  border: 1px dashed #d9c6b2;
  border-radius: 8px;
}

.ecu-msg-main {
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
  gap: 0;
}

.ecu-msg-body {
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
  min-width: 0;
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
  min-height: 0;
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  background: rgba(255, 255, 255, 0.66);
  overflow: hidden;
}

.ecu-msg-pane-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-bottom: 1px solid #e5d4c5;
  color: #5e4a3a;
}

.ecu-msg-count {
  font-size: 12px;
  color: #887461;
  margin: 0 8px 0 auto;
}

.ecu-msg-sort-bar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  border-radius: 6px;
  background: #f5f0eb;
  flex-shrink: 0;
}

.ecu-msg-sort-label {
  font-size: 11px;
  color: #8b7355;
  font-weight: 600;
  margin-right: 2px;
  white-space: nowrap;
}

.ecu-msg-sort-chip {
  display: inline-block;
  padding: 1px 8px;
  border-radius: 999px;
  background: #fff;
  border: 1px solid #d4c5b5;
  font-size: 11px;
  color: #5e4a3a;
  cursor: grab;
  user-select: none;
  white-space: nowrap;
  transition: background 0.15s, border-color 0.15s, box-shadow 0.15s;
}

.ecu-msg-sort-chip:hover {
  background: #e8d9c8;
  border-color: #b08863;
}

.ecu-msg-sort-chip:active {
  cursor: grabbing;
}

.ecu-msg-sort-chip.sort-drag-over {
  border-color: #b08863;
  box-shadow: 0 0 0 2px rgba(176, 136, 99, 0.3);
  background: #e8d9c8;
}

.ecu-msg-collapse {
  border: 0;
  background: transparent;
  color: #7b6551;
  font-size: 12px;
}

/* Card Layout */
.ecu-msg-cards {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  padding: 16px;
  columns: 230px;
  column-gap: 16px;
}

.ecu-msg-card {
  break-inside: avoid;
  margin-bottom: 16px;
  width: 230px;
  max-width: 100%;
  border-radius: 12px;
  border: 2px solid #ddd;
  background: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  overflow: hidden;
  cursor: pointer;
  transition: box-shadow 0.2s, transform 0.15s, border-color 0.2s;
  display: flex;
  flex-direction: column;
}

.ecu-msg-card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  transform: translateY(-2px);
}

.ecu-msg-card.selected {
  border-color: var(--card-color, #b08863);
  background: #fff;
  box-shadow:
    0 0 0 3px var(--card-color, #b08863),
    0 0 24px 6px color-mix(in srgb, var(--card-color, #b08863) 35%, transparent),
    0 12px 40px rgba(0, 0, 0, 0.22);
  transform: scale(1.04) translateY(-4px);
  z-index: 2;
  position: relative;
}

.ecu-msg-card.selected::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 10px;
  background: color-mix(in srgb, var(--card-color, #b08863) 6%, transparent);
  pointer-events: none;
  z-index: 0;
}

.ecu-msg-card.selected > * {
  position: relative;
  z-index: 1;
}

.ecu-msg-card.has-error {
  border-color: #d32f2f;
  background: #fff5f5;
  box-shadow: 0 0 0 2px #d32f2f, 0 0 20px 4px rgba(211, 47, 47, 0.35);
  animation: ecu-error-pulse 2s ease-in-out infinite;
}

@keyframes ecu-error-pulse {
  0%, 100% { box-shadow: 0 0 0 2px #d32f2f, 0 0 20px 4px rgba(211, 47, 47, 0.35); }
  50% { box-shadow: 0 0 0 3px #ef5350, 0 0 28px 8px rgba(211, 47, 47, 0.5); }
}

.ecu-msg-card.has-error:hover {
  box-shadow: 0 0 0 3px #d32f2f, 0 0 30px 8px rgba(211, 47, 47, 0.45);
  transform: translateY(-2px);
}

.ecu-msg-card.has-error .ecu-msg-card-head {
  background-image: repeating-linear-gradient(
    45deg,
    transparent,
    transparent 6px,
    rgba(255, 255, 255, 0.15) 6px,
    rgba(255, 255, 255, 0.15) 12px
  );
}

.ecu-msg-card.has-error .ecu-msg-card-body {
  background: #fff5f5;
}

.ecu-msg-card.has-error .ecu-msg-card-id-row::after {
  content: '⚠ 重复';
  display: inline-block;
  margin-left: 4px;
  padding: 0 5px;
  border-radius: 999px;
  background: #d32f2f;
  color: #fff;
  font-size: 9px;
  font-weight: 700;
  line-height: 1.6;
  white-space: nowrap;
  flex-shrink: 0;
}

.ecu-msg-card-head {
  padding: 4px 10px;
  color: #fff;
  display: flex;
  flex-direction: column;
  gap: 0;
  min-height: 28px;
  justify-content: center;
}

.ecu-msg-card-id-row {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
  min-width: 0;
}

.ecu-msg-card-id {
  font-size: 11px;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  opacity: 0.9;
  letter-spacing: 0.3px;
  flex-shrink: 0;
}

.ecu-msg-peer-tag {
  display: inline-block;
  padding: 0 5px;
  border: 1px solid;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 500;
  line-height: 1.4;
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex-shrink: 0;
  background: #fff;
  border-color: currentColor;
}

.ecu-msg-card-name {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ecu-msg-card-body {
  padding: 8px 0;
  background: #fefefe;
  flex: 1;
}

.ecu-msg-card-signal {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 7px 14px;
  font-size: 13px;
  border-bottom: 1px solid #f3ece6;
  transition: background 0.12s;
  cursor: pointer;
}

.ecu-msg-card-signal:last-child {
  border-bottom: none;
}

.ecu-msg-card-signal:hover {
  background: rgba(183, 150, 124, 0.08);
}

.ecu-msg-card-signal.selected {
  background: rgba(183, 150, 124, 0.18);
}

.ecu-msg-signal-name {
  color: #4a3728;
  font-weight: 500;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ecu-msg-signal-len {
  color: #8a7260;
  font-size: 12px;
  flex-shrink: 0;
  margin-left: 12px;
  background: #f5efe8;
  padding: 2px 8px;
  border-radius: 999px;
}

.ecu-msg-card-empty {
  padding: 20px 14px;
  text-align: center;
  color: #b8a494;
  font-size: 13px;
}

.ecu-msg-splitter {
  flex: 0 0 8px;
  width: 8px;
  cursor: col-resize;
  background: linear-gradient(180deg, #ead8c7 0%, #dfc7b1 100%);
}

.ecu-msg-props-splitter {
  flex: 0 0 6px;
  width: 6px;
  cursor: col-resize;
  background: linear-gradient(180deg, #ead8c7 0%, #dfc7b1 100%);
  border-radius: 3px;
  margin: 4px 0;
  transition: background 0.15s;
}

.ecu-msg-props-splitter:hover {
  background: linear-gradient(180deg, #d4b896 0%, #c9a87a 100%);
}

.ecu-msg-props {
  flex-shrink: 0;
  overflow: auto;
  border: 1px solid #dac7b5;
  border-radius: 8px;
  background: rgba(255, 252, 247, 0.96);
  padding: 8px;
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
</style>