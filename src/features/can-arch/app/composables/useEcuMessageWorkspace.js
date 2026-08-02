import { computed, nextTick, ref, watch } from 'vue';
import { CanMessage } from '../../domain/models/CanMessage.js';

function intersects(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length === 0 || b.length === 0) return false;
  const set = new Set(a);
  return b.some((item) => set.has(item));
}

function cacheKey(ecu, bus) {
  if (!ecu || !bus) return '';
  return `${ecu}__${bus}`;
}

const filterStateCache = new Map();
const preSnapshot = new Map();

export function detectMessageErrors(rxMessages, txMessages) {
  const errors = new Map();
  const allMessages = [...rxMessages, ...txMessages];

  const nameMap = new Map();
  for (const msg of allMessages) {
    const name = (msg.name || '').trim();
    if (!name) continue;
    if (!nameMap.has(name)) {
      nameMap.set(name, []);
    }
    nameMap.get(name).push(msg.id);
  }
  for (const [, ids] of nameMap) {
    if (ids.length > 1) {
      for (const id of ids) {
        const existing = errors.get(id) || { types: [], messages: [] };
        existing.types.push('duplicate_name');
        const dupName = allMessages.find((m) => m.id === id)?.name || '';
        existing.messages.push(`报文名称 "${dupName}" 重复`);
        errors.set(id, existing);
      }
    }
  }

  const idHexMap = new Map();
  for (const msg of allMessages) {
    const idHex = (msg.idHex || '').trim();
    if (!idHex) continue;
    if (!idHexMap.has(idHex)) {
      idHexMap.set(idHex, []);
    }
    idHexMap.get(idHex).push(msg.id);
  }
  for (const [, ids] of idHexMap) {
    if (ids.length > 1) {
      for (const id of ids) {
        const existing = errors.get(id) || { types: [], messages: [] };
        existing.types.push('duplicate_id');
        const dupIdHex = allMessages.find((m) => m.id === id)?.idHex || '';
        existing.messages.push(`报文 ID "${dupIdHex}" 重复`);
        errors.set(id, existing);
      }
    }
  }

  return errors;
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
  const filterProtocols = ref([...protocolValues]);

  const ecuId = computed(() => ecuRef.value?.id || '');

  const activeTab = computed(() => busTabsRef.value.find((tab) => tab.busId === activeBusId.value) || null);
  const peerOptions = computed(() => activeTab.value?.peers || []);

  const switchState = {
    ecuChanged: false,
    busChanged: false,
    pendingEcuId: '',
    pendingOldEcuId: '',
    pendingBusId: '',
    pendingOldBusId: '',
    capturedFilters: null,
    capturedOldBusId: '',
    scheduled: false,
  };

  function captureCurrentFilters() {
    return {
      peerIds: [...filterPeerIds.value],
      protocols: [...filterProtocols.value],
    };
  }

  function resolvePeersForBus(busId) {
    const tabs = busTabsRef.value;
    if (!Array.isArray(tabs) || tabs.length === 0) return [];
    const tab = tabs.find((t) => t.busId === busId);
    return tab?.peers || [];
  }

  function saveFiltersFor(ecu, bus, snapshot) {
    const key = cacheKey(ecu, bus);
    if (!key) return;
    const peers = resolvePeersForBus(bus);
    let validPeerIds = [...snapshot.peerIds];
    if (peers.length > 0) {
      const validSet = new Set(peers.map((p) => p.id));
      validPeerIds = snapshot.peerIds.filter((id) => validSet.has(id));
    }
    filterStateCache.set(key, {
      peerIds: validPeerIds,
      protocols: [...snapshot.protocols],
    });
  }

  function applyPeerSelectionForBus(targetEcuId = ecuId.value, targetBusId = activeBusId.value) {
    const peers = resolvePeersForBus(targetBusId);
    if (!peers || peers.length === 0) {
      filterPeerIds.value = [];
      filterProtocols.value = [...protocolValues];
      return;
    }
    const key = cacheKey(targetEcuId, targetBusId);
    if (key) {
      const cached = filterStateCache.get(key);
      if (cached && cached.peerIds?.length > 0) {
        const validSet = new Set(peers.map((p) => p.id));
        const filtered = cached.peerIds.filter((id) => validSet.has(id));
        if (filtered.length > 0) {
          filterPeerIds.value = filtered;
          if (cached.protocols?.length) {
            filterProtocols.value = cached.protocols;
          }
          return;
        }
      }
    }
    filterPeerIds.value = peers.map((p) => p.id);
    filterProtocols.value = [...protocolValues];
  }

  function isWorkspaceConsistent(ecu, bus) {
    if (!ecu || !bus) return false;
    const tabs = busTabsRef.value;
    if (!Array.isArray(tabs) || tabs.length === 0) return false;
    return tabs.some((tab) => tab.busId === bus);
  }

  function flushSwitch() {
    if (!switchState.ecuChanged && !switchState.busChanged) return;

    const newEcuId = switchState.ecuChanged ? switchState.pendingEcuId : ecuId.value;
    const newBusId = switchState.busChanged ? switchState.pendingBusId : activeBusId.value;

    if (switchState.ecuChanged && switchState.pendingOldEcuId) {
      const oldBusForOldEcu = switchState.busChanged
        ? switchState.pendingOldBusId
        : (switchState.capturedOldBusId || activeBusId.value);
      if (switchState.pendingOldEcuId && oldBusForOldEcu) {
        const k = cacheKey(switchState.pendingOldEcuId, oldBusForOldEcu);
        const snapshot = preSnapshot.get(k) || switchState.capturedFilters;
        if (snapshot) {
          saveFiltersFor(switchState.pendingOldEcuId, oldBusForOldEcu, snapshot);
        }
      }
    }

    if (switchState.busChanged && switchState.pendingOldBusId && !switchState.ecuChanged) {
      if (ecuId.value && switchState.pendingOldBusId) {
        const k = cacheKey(ecuId.value, switchState.pendingOldBusId);
        const snapshot = preSnapshot.get(k) || switchState.capturedFilters;
        if (snapshot) {
          saveFiltersFor(ecuId.value, switchState.pendingOldBusId, snapshot);
        }
      }
    }

    if (switchState.busChanged && activeBusId.value !== newBusId) {
      activeBusId.value = newBusId;
    }

    if (switchState.ecuChanged || switchState.busChanged) {
      applyPeerSelectionForBus(newEcuId, newBusId);
    }

    switchState.ecuChanged = false;
    switchState.busChanged = false;
    switchState.pendingEcuId = '';
    switchState.pendingOldEcuId = '';
    switchState.pendingBusId = '';
    switchState.pendingOldBusId = '';
    switchState.capturedFilters = null;
    switchState.capturedOldBusId = '';
    switchState.scheduled = false;
  }

  function scheduleFlush() {
    if (switchState.scheduled) return;
    switchState.scheduled = true;
    nextTick(() => {
      flushSwitch();
    });
  }

  watch(
    () => busTabsRef.value,
    (tabs) => {
      if (!Array.isArray(tabs) || tabs.length === 0) {
        activeBusId.value = '';
        return;
      }
      const needsInit = !tabs.some((tab) => tab.busId === activeBusId.value);
      if (needsInit) {
        activeBusId.value = tabs[0].busId;
      }
      if (needsInit && ecuId.value) {
        nextTick(() => {
          if (!switchState.ecuChanged && !switchState.busChanged) {
            applyPeerSelectionForBus();
          }
        });
      }
    },
    { immediate: true }
  );

  watch(
    () => ecuId.value,
    (newId, oldId) => {
      if (!oldId) return;

      switchState.capturedFilters = captureCurrentFilters();
      switchState.capturedOldBusId = activeBusId.value;
      switchState.pendingOldEcuId = oldId;
      switchState.pendingEcuId = newId;
      switchState.ecuChanged = true;

      scheduleFlush();
    },
    { immediate: true }
  );

  watch(
    () => activeBusId.value,
    (newBus, oldBus) => {
      if (!ecuId.value) return;
      if (!oldBus || oldBus === newBus) return;

      if (!switchState.capturedFilters) {
        switchState.capturedFilters = captureCurrentFilters();
      }

      switchState.pendingOldBusId = oldBus;
      switchState.pendingBusId = newBus;
      switchState.busChanged = true;

      scheduleFlush();
    },
    { immediate: true }
  );
  watch(
    [filterPeerIds, filterProtocols],
    () => {
      if (switchState.ecuChanged || switchState.busChanged) return;
      const ecu = ecuId.value;
      const bus = activeBusId.value;
      if (!isWorkspaceConsistent(ecu, bus)) return;
      const snapshot = captureCurrentFilters();
      saveFiltersFor(ecu, bus, snapshot);
      preSnapshot.set(cacheKey(ecu, bus), snapshot);
    }
  );

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

  const messageErrors = computed(() => detectMessageErrors(rxMessages.value, txMessages.value));

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
    messageErrors,
  };
}