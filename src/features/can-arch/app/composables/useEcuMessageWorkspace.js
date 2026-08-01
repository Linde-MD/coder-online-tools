import { computed, ref, watch } from 'vue';
import { CanMessage } from '../../domain/models/CanMessage.js';

function intersects(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length === 0 || b.length === 0) return false;
  const set = new Set(a);
  return b.some((item) => set.has(item));
}

export function useEcuMessageWorkspace({ ecuRef, busTabsRef }) {
  const protocolOptions = Object.freeze([
    { value: 'generic_std', label: 'Generic(Std)' },
    { value: 'generic_ext', label: 'Generic(Ext)' },
    { value: 'j1939', label: 'J1939' },
    { value: 'canopen', label: 'CANopen' },
  ]);
  const protocolValues = protocolOptions.map((item) => item.value);

  const activeBusId = ref('');
  const filterPeerIds = ref([]);
  const filterProtocols = ref([]);

  watch(
    () => busTabsRef.value,
    (tabs) => {
      if (!Array.isArray(tabs) || tabs.length === 0) {
        activeBusId.value = '';
        return;
      }
      if (!tabs.some((tab) => tab.busId === activeBusId.value)) {
        activeBusId.value = tabs[0].busId;
      }
    },
    { immediate: true }
  );

  const activeTab = computed(() => busTabsRef.value.find((tab) => tab.busId === activeBusId.value) || null);
  const peerOptions = computed(() => activeTab.value?.peers || []);

  const protocolColor = CanMessage.colorForProtocol;

  function ensureWorkspace() {
    if (!ecuRef.value.messageWorkspace || typeof ecuRef.value.messageWorkspace !== 'object') {
      ecuRef.value.messageWorkspace = {};
    }
    return ecuRef.value.messageWorkspace;
  }

  function getBusStore(busId) {
    const workspace = ensureWorkspace();
    if (!workspace[busId]) {
      workspace[busId] = { rxMessages: [], txMessages: [] };
    }
    return workspace[busId];
  }

  const rxMessages = computed(() => {
    if (!activeTab.value) return [];
    return getBusStore(activeTab.value.busId).rxMessages;
  });

  const txMessages = computed(() => {
    if (!activeTab.value) return [];
    return getBusStore(activeTab.value.busId).txMessages;
  });

  const filteredRxMessages = computed(() =>
    rxMessages.value.filter((message) => {
      const peerOk = filterPeerIds.value.length === 0 || intersects(message.senders, filterPeerIds.value);
      const protocolOk = filterProtocols.value.length === 0 || filterProtocols.value.includes(message.protocol);
      return peerOk && protocolOk;
    })
  );

  const filteredTxMessages = computed(() =>
    txMessages.value.filter((message) => {
      const peerOk = filterPeerIds.value.length === 0 || intersects(message.receivers, filterPeerIds.value);
      const protocolOk = filterProtocols.value.length === 0 || filterProtocols.value.includes(message.protocol);
      return peerOk && protocolOk;
    })
  );

  function flattenRows(messages, pane) {
    const rows = [];
    for (const message of messages) {
      rows.push({
        key: `${pane}|m|${message.id}`,
        type: 'message',
        label: `${message.name} (${message.idHex})`,
        protocol: message.protocol,
        message,
        signal: null,
      });
      for (const signal of message.signals) {
        rows.push({
          key: `${pane}|s|${message.id}|${signal.id}`,
          type: 'signal',
          label: `-> ${signal.name} [${signal.startBit}|${signal.length}]`,
          protocol: message.protocol,
          message,
          signal,
        });
      }
    }
    return rows;
  }

  const rxRows = computed(() => flattenRows(filteredRxMessages.value, 'rx'));
  const txRows = computed(() => flattenRows(filteredTxMessages.value, 'tx'));

  const getRowsByPane = (pane) => (pane === 'rx' ? rxRows.value : txRows.value);

  function createDefaultMessage(pane) {
    const peers = peerOptions.value;
    const peerIds = filterPeerIds.value.length > 0 ? [...filterPeerIds.value] : peers.map((peer) => peer.id);
    const protocol = filterProtocols.value[0] || 'generic_std';
    return CanMessage.createDefault(pane, ecuRef.value?.id, peerIds, protocol).toJSON();
  }

  function addMessage(pane) {
    if (!activeTab.value) return;
    const targetList = pane === 'rx' ? rxMessages.value : txMessages.value;
    targetList.push(createDefaultMessage(pane));
  }

  function addSignalToMessage(message) {
    if (!message) return null;
    if (typeof message.addSignal === 'function') {
      return message.addSignal();
    }
    const signal = {
      id: crypto.randomUUID(),
      name: `SIG_${(message.signals?.length || 0) + 1}`,
      startBit: 0,
      length: 8,
      factor: 1,
      offset: 0,
      signed: false,
      unit: '',
      comment: '',
    };
    message.signals.push(signal);
    return signal;
  }

  function syncMessageProtocolColor(message) {
    const m = message instanceof CanMessage ? message : null;
    if (m) {
      m.syncProtocolColor();
      return;
    }
    message.color = protocolColor(message.protocol);
    if (message.protocol !== 'j1939' && message.j1939) {
      message.j1939.enabled = false;
    }
  }

  function selectAllPeerFilters() {
    filterPeerIds.value = peerOptions.value.map((item) => item.id);
  }
  function clearPeerFilters() {
    filterPeerIds.value = [];
  }
  function selectAllProtocolFilters() {
    filterProtocols.value = [...protocolValues];
  }
  function clearProtocolFilters() {
    filterProtocols.value = [];
  }

  return {
    protocolOptions,
    protocolValues,
    activeBusId,
    activeTab,
    peerOptions,
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
  };
}