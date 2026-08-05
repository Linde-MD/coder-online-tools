import { computed, nextTick, ref, watch } from 'vue';
import { CanMessage } from '../../domain/models/CanMessage.js';
import { decodeJ1939Id, encodeJ1939IdFromPgn, parseNumberInput } from '../../../../shared/utils/j1939.js';

const J1939_PRIORITY_DONT_CARE = 'dont_care';

function isJ1939PriorityDontCare(priority) {
  return String(priority ?? '').trim().toLowerCase() === J1939_PRIORITY_DONT_CARE;
}

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

function resolveMessageTotalBits(message) {
  const rawDlc = Number.parseInt(message?.dlc, 10);
  const dlc = Number.isInteger(rawDlc) ? Math.max(0, Math.min(64, rawDlc)) : 8;
  return Math.max(0, dlc * 8);
}

function expandSignalBits(signal, byteOrder = 'intel') {
  const rawLength = Number.parseInt(signal?.length, 10);
  const length = Number.isInteger(rawLength) ? Math.max(1, rawLength) : 1;
  const rawStart = Number.parseInt(signal?.startBit, 10);
  const startBit = Number.isInteger(rawStart) ? rawStart : 0;
  const bits = [];

  if (byteOrder === 'motorola') {
    // Vector-style Motorola startBit: treat startBit as LSB index.
    let current = startBit;
    for (let idx = 0; idx < length; idx += 1) {
      bits.push(current);
      if (current % 8 === 7) {
        current -= 15;
      } else {
        current += 1;
      }
    }
    return bits;
  }

  for (let idx = 0; idx < length; idx += 1) {
    bits.push(startBit + idx);
  }
  return bits;
}

function collectMessageLayoutErrors(message) {
  const layoutErrors = [];
  if (!message) return layoutErrors;

  const totalBits = resolveMessageTotalBits(message);
  const byteOrder = message?.byteOrder === 'motorola' ? 'motorola' : 'intel';
  const signals = Array.isArray(message?.signals) ? message.signals : [];
  const bitOwners = new Map();

  for (const signal of signals) {
    if (!signal) continue;
    const signalName = String(signal.name || '未命名Signal');
    const bits = expandSignalBits(signal, byteOrder);

    const outOfRangeBits = bits.filter((bit) => bit < 0 || bit >= totalBits);
    if (outOfRangeBits.length > 0) {
      layoutErrors.push(`Signal "${signalName}" 超出可用 bit 范围（DLC=${message.dlc}，字节序=${byteOrder}）。`);
    }

    for (const bit of bits) {
      if (bit < 0 || bit >= totalBits) continue;
      if (!bitOwners.has(bit)) {
        bitOwners.set(bit, []);
      }
      bitOwners.get(bit).push(signalName);
    }
  }

  const overlapPairs = new Set();
  for (const [, owners] of bitOwners) {
    if (owners.length <= 1) continue;
    const uniqueOwners = [...new Set(owners)].sort();
    for (let i = 0; i < uniqueOwners.length; i += 1) {
      for (let j = i + 1; j < uniqueOwners.length; j += 1) {
        overlapPairs.add(`${uniqueOwners[i]} <> ${uniqueOwners[j]}`);
      }
    }
  }

  if (overlapPairs.size > 0) {
    layoutErrors.push(`Signal bit 区间重叠：${[...overlapPairs].join('；')}`);
  }

  return layoutErrors;
}

function collectMessageJ1939Errors(message) {
  const j1939Errors = [];
  if (!message || message.protocol !== 'j1939') return j1939Errors;

  const j1939 = message.j1939 || {};
  const priorityDontCare = isJ1939PriorityDontCare(j1939.priority);

  let rawId = null;
  if (!priorityDontCare) {
    rawId = parseNumberInput(message.idHex);
    if (!Number.isInteger(rawId)) {
      j1939Errors.push('J1939 报文 ID 无效：请输入 0x 十六进制或十进制 ID。');
      return j1939Errors;
    }

    const decoded = decodeJ1939Id(rawId);
    if (!decoded.valid) {
      j1939Errors.push(decoded.error);
      return j1939Errors;
    }
  }

  const pgn = parseNumberInput(j1939.pgn);
  const priority = parseNumberInput(j1939.priority);
  const sa = parseNumberInput(j1939.sa);
  if (!Number.isInteger(pgn) || pgn < 0 || pgn > 0x3FFFF) {
    j1939Errors.push('J1939 字段错误：PGN 必须是 0 ~ 0x3FFFF 的整数。');
  }
  if (!priorityDontCare && (!Number.isInteger(priority) || priority < 0 || priority > 7)) {
    j1939Errors.push('J1939 字段错误：Priority 必须是 0 ~ 7 的整数。');
  }
  if (!Number.isInteger(sa) || sa < 0 || sa > 0xFF) {
    j1939Errors.push('J1939 字段错误：SA 必须是 0 ~ 255 的整数。');
  }
  if (j1939Errors.length > 0) {
    return j1939Errors;
  }

  const pf = (pgn >> 8) & 0xFF;
  const isPdu2 = pf >= 240;
  const da = isPdu2 ? 0 : parseNumberInput(j1939.da);
  if (!isPdu2 && (!Number.isInteger(da) || da < 0 || da > 0xFF)) {
    j1939Errors.push('J1939 字段错误：PF < 240 时，DA 必须是 0 ~ 255 的整数。');
    return j1939Errors;
  }

  if (priorityDontCare) {
    return j1939Errors;
  }

  const encoded = encodeJ1939IdFromPgn(pgn, priority, sa, da);
  if (!encoded.valid) {
    j1939Errors.push(encoded.error);
    return j1939Errors;
  }

  if (encoded.id !== rawId) {
    j1939Errors.push('J1939 字段与 ID 不一致：请检查 PGN/Priority/SA/DA 与 ID 的对应关系。');
  }

  return j1939Errors;
}

function resolveJ1939DuplicateKey(message) {
  if (!message || message.protocol !== 'j1939') return '';

  const j1939 = message.j1939 || {};
  const pgn = parseNumberInput(j1939.pgn);
  const sa = parseNumberInput(j1939.sa);

  if (Number.isInteger(pgn) && pgn >= 0 && pgn <= 0x3FFFF && Number.isInteger(sa) && sa >= 0 && sa <= 0xFF) {
    const pf = (pgn >> 8) & 0xFF;
    const isPdu2 = pf >= 240;
    const da = isPdu2 ? 'broadcast' : parseNumberInput(j1939.da);
    if (isPdu2 || (Number.isInteger(da) && da >= 0 && da <= 0xFF)) {
      return `${pgn}|${sa}|${da}`;
    }
  }

  const rawId = parseNumberInput(message.idHex);
  if (!Number.isInteger(rawId)) return '';
  const decoded = decodeJ1939Id(rawId);
  if (!decoded.valid) return '';
  const da = decoded.isBroadcast ? 'broadcast' : decoded.destinationAddress;
  return `${decoded.PGN}|${decoded.SA}|${da}`;
}

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

  const j1939KeyMap = new Map();
  for (const msg of allMessages) {
    const key = resolveJ1939DuplicateKey(msg);
    if (!key) continue;
    if (!j1939KeyMap.has(key)) {
      j1939KeyMap.set(key, []);
    }
    j1939KeyMap.get(key).push(msg.id);
  }
  for (const [key, ids] of j1939KeyMap) {
    if (ids.length <= 1) continue;
    const [pgn, sa, da] = key.split('|');
    for (const id of ids) {
      const existing = errors.get(id) || { types: [], messages: [] };
      existing.types.push('duplicate_j1939_tuple');
      existing.messages.push(`J1939 组合重复：PGN=${pgn}, SA=${sa}, DA=${da}（忽略 Priority）。`);
      errors.set(id, existing);
    }
  }

  for (const message of allMessages) {
    if (!message?.id) continue;
    const senders = Array.isArray(message.senders) ? message.senders : [];
    const receivers = Array.isArray(message.receivers) ? message.receivers : [];
    const isReceiverBroadcast = message.receiverMode === 'broadcast';
    const existing = errors.get(message.id) || { types: [], messages: [] };

    if (senders.length === 0) {
      existing.types.push('missing_sender');
      existing.messages.push('未配置发送方节点。');
    }

    if (!isReceiverBroadcast && receivers.length === 0) {
      existing.types.push('missing_receiver');
      existing.messages.push('未配置接收方节点。');
    }

    const layoutErrors = collectMessageLayoutErrors(message);
    for (const errText of layoutErrors) {
      existing.types.push('layout_error');
      existing.messages.push(errText);
    }

    const j1939Errors = collectMessageJ1939Errors(message);
    for (const errText of j1939Errors) {
      existing.types.push('j1939_error');
      existing.messages.push(errText);
    }

    if (existing.types.length > 0) {
      errors.set(message.id, existing);
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
  const includeRxBroadcast = ref(false);

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
      const addressedToCurrentEcu = intersects(message.receivers, [ecuId.value]);
      const peerOk = (includeRxBroadcast.value && message.receiverMode === 'broadcast') || addressedToCurrentEcu;
      const protocolOk = filterProtocols.value.length === 0 || filterProtocols.value.includes(message.protocol);
      return peerOk && protocolOk;
    })
  );

  const filteredTxMessages = computed(() =>
    txMessages.value.filter((message) => {
      const ownsMessage = intersects(message.senders, [ecuId.value]);
      const peerOk = ownsMessage;
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
    includeRxBroadcast,
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