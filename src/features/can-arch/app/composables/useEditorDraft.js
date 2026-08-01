import { ref } from 'vue';

export function useEditorDraft({
  singleSelectedNode,
  singleSelectedBus,
  normalizeBusColor,
  normalizeNodeBaseColor,
  DEFAULT_NODE_BASE_COLOR,
  DEFAULT_BUS_BAUD,
  BUS_COLOR_POOL,
  validateCanNodeDraft,
  pushHistorySnapshot,
  persistNodes,
  setStatus,
  nowIso,
  pruneNodeConnectedLinkCapabilities,
}) {
  const formErrors = ref([]);
  const formWarnings = ref([]);

  const draft = reactive({
    name: '',
    note: '',
    protocols: [],
    j1939AddressesInput: '',
    canopenNodeIdsInput: '',
    baseColor: DEFAULT_NODE_BASE_COLOR,
  });

  const busDraft = reactive({
    name: '',
    baudRate: DEFAULT_BUS_BAUD,
    color: BUS_COLOR_POOL[0],
  });

  let isSyncingDraft = false;
  let isSyncingBusDraft = false;
  let draftApplyTimerId = null;
  let busDraftApplyTimerId = null;
  let draftHistoryNodeId = null;
  let busDraftHistoryBusId = null;

  function syncDraftFromSelected() {
    isSyncingDraft = true;
    stopDraftApplyTimer();
    draftHistoryNodeId = null;
    formErrors.value = [];
    formWarnings.value = [];
    const node = singleSelectedNode.value;
    if (!node) {
      draft.name = '';
      draft.note = '';
      draft.protocols = [];
      draft.j1939AddressesInput = '';
      draft.canopenNodeIdsInput = '';
      draft.baseColor = DEFAULT_NODE_BASE_COLOR;
      isSyncingDraft = false;
      return;
    }
    draft.name = node.name;
    draft.note = node.note || '';
    draft.protocols = [...node.protocols];
    draft.j1939AddressesInput = node.j1939Addresses.join(', ');
    draft.canopenNodeIdsInput = node.canopenNodeIds.join(', ');
    draft.baseColor = normalizeNodeBaseColor(node.baseColor);
    isSyncingDraft = false;
  }

  function syncBusDraftFromSelected() {
    isSyncingBusDraft = true;
    if (busDraftApplyTimerId) {
      window.clearTimeout(busDraftApplyTimerId);
      busDraftApplyTimerId = null;
    }
    busDraftHistoryBusId = null;
    const bus = singleSelectedBus.value;
    if (!bus) {
      busDraft.name = '';
      busDraft.baudRate = DEFAULT_BUS_BAUD;
      busDraft.color = BUS_COLOR_POOL[0];
      isSyncingBusDraft = false;
      return;
    }
    busDraft.name = bus.name;
    busDraft.baudRate = bus.baudRate;
    busDraft.color = normalizeBusColor(bus.color);
    isSyncingBusDraft = false;
  }

  function stopDraftApplyTimer() {
    if (!draftApplyTimerId) return;
    window.clearTimeout(draftApplyTimerId);
    draftApplyTimerId = null;
  }

  function toggleDraftProtocol(protocol, checked) {
    if (checked) {
      if (!draft.protocols.includes(protocol)) {
        draft.protocols = [...draft.protocols, protocol];
      }
      return;
    }
    draft.protocols = draft.protocols.filter((token) => token !== protocol);
  }

  function resetDraft() {
    syncDraftFromSelected();
  }

  function applyDraftToSelectedNode(manual = false) {
    const target = singleSelectedNode.value;
    if (!target) return;

    const result = validateCanNodeDraft(draft);
    formErrors.value = result.errors;
    formWarnings.value = result.warnings;

    if (result.errors.length > 0) {
      if (manual) {
        setStatus('节点属性校验失败，请先修正。', true);
      }
      return;
    }

    const duplicatedName = nodes.value.find(
      (item) => item.id !== target.id && item.name === result.normalized.name
    );
    if (duplicatedName) {
      formErrors.value = ['节点名称重复，请使用不同名称。'];
      if (manual) {
        setStatus('节点名称重复。', true);
      }
      return;
    }

    const normalizedBaseColor = normalizeNodeBaseColor(draft.baseColor);
    const changed = target.name !== result.normalized.name ||
      target.note !== result.normalized.note ||
      JSON.stringify(target.protocols) !== JSON.stringify(result.normalized.protocols) ||
      JSON.stringify(target.j1939Addresses) !== JSON.stringify(result.normalized.j1939Addresses) ||
      JSON.stringify(target.canopenNodeIds) !== JSON.stringify(result.normalized.canopenNodeIds) ||
      normalizeNodeBaseColor(target.baseColor) !== normalizedBaseColor;

    if (!changed) {
      if (manual) {
        setStatus('属性没有变化。');
      }
      return;
    }

    if (draftHistoryNodeId !== target.id) {
      pushHistorySnapshot();
      draftHistoryNodeId = target.id;
    }

    target.name = result.normalized.name;
    target.note = result.normalized.note;
    target.protocols = result.normalized.protocols;
    target.j1939Addresses = result.normalized.j1939Addresses;
    target.canopenNodeIds = result.normalized.canopenNodeIds;
    target.baseColor = normalizedBaseColor;
    target.updatedAt = nowIso();

    pruneNodeConnectedLinkCapabilities(
      target.id,
      result.normalized.protocols,
      result.normalized.j1939Addresses,
      result.normalized.canopenNodeIds
    );

    persistNodes();
    if (manual) {
      setStatus(`已保存节点 ${target.name}`);
    }
  }

  function scheduleDraftAutoApply() {
    if (isSyncingDraft) return;
    if (!singleSelectedNode.value) return;
    stopDraftApplyTimer();
    draftApplyTimerId = window.setTimeout(() => {
      draftApplyTimerId = null;
      applyDraftToSelectedNode(false);
    }, 220);
  }

  function applyBusDraftToSelected() {
    const bus = singleSelectedBus.value;
    if (!bus) return;
    const normalizedName = String(busDraft.name || '').trim();
    if (!normalizedName) return;
    const normalizedBaud = Math.max(10, Math.round(Number(busDraft.baudRate) || DEFAULT_BUS_BAUD));
    const normalizedColor = normalizeBusColor(busDraft.color, bus.color);

    const duplicatedName = buses.value.find((item) => item.id !== bus.id && item.name === normalizedName);
    if (duplicatedName) return;

    const changed = bus.name !== normalizedName ||
      bus.baudRate !== normalizedBaud ||
      normalizeBusColor(bus.color) !== normalizedColor;
    if (!changed) return;

    if (busDraftHistoryBusId !== bus.id) {
      pushHistorySnapshot();
      busDraftHistoryBusId = bus.id;
    }

    bus.name = normalizedName;
    bus.baudRate = normalizedBaud;
    bus.color = normalizedColor;
    persistNodes();
  }

  function scheduleBusDraftAutoApply() {
    if (isSyncingBusDraft) return;
    if (!singleSelectedBus.value) return;
    if (busDraftApplyTimerId) {
      window.clearTimeout(busDraftApplyTimerId);
    }
    busDraftApplyTimerId = window.setTimeout(() => {
      busDraftApplyTimerId = null;
      applyBusDraftToSelected();
    }, 220);
  }

  function saveDraft() {
    applyDraftToSelectedNode(true);
  }

  return {
    formErrors,
    formWarnings,
    draft,
    busDraft,
    syncDraftFromSelected,
    syncBusDraftFromSelected,
    toggleDraftProtocol,
    resetDraft,
    applyDraftToSelectedNode,
    applyBusDraftToSelected,
    scheduleDraftAutoApply,
    scheduleBusDraftAutoApply,
    saveDraft,
    stopDraftApplyTimer,
  };
}