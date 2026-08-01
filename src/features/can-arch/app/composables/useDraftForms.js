import { reactive, ref, computed } from 'vue';
import {
  canProtocols,
} from '@/features/can-arch/services/can-arch-dbc.js';
import {
  DEFAULT_BUS_BAUD,
  DEFAULT_NODE_BASE_COLOR,
  BUS_COLOR_POOL,
  LINK_STYLE_OPTIONS,
} from '@/features/can-arch/domain/can-arch-constants.js';
import {
  normalizeNodeBaseColor,
} from '@/features/can-arch/domain/can-arch-colors.js';
import {
  normalizeProtocolsList as domainNormalizeProtocolsList,
  normalizeLinkStyle as domainNormalizeLinkStyle,
  normalizeIntegerList as domainNormalizeIntegerList,
} from '@/features/can-arch/domain/can-arch-normalizers.js';
import {
  resolveNodeDefaultProtocols as domainResolveNodeDefaultProtocols,
  resolveNodeDefaultJ1939Addresses as domainResolveNodeDefaultJ1939Addresses,
  resolveNodeDefaultCanopenNodeIds as domainResolveNodeDefaultCanopenNodeIds,
  resolveLinkAllowedProtocols as domainResolveLinkAllowedProtocols,
  resolveLinkAllowedJ1939Addresses as domainResolveLinkAllowedJ1939Addresses,
  resolveLinkAllowedCanopenNodeIds as domainResolveLinkAllowedCanopenNodeIds,
  normalizeLinkProtocolsByNode as domainNormalizeLinkProtocolsByNode,
  normalizeLinkJ1939AddressesByNode as domainNormalizeLinkJ1939AddressesByNode,
  normalizeLinkCanopenNodeIdsByNode as domainNormalizeLinkCanopenNodeIds,
} from '@/features/can-arch/domain/can-arch-protocols.js';

const SUPPORTED_CAN_PROTOCOLS = [
  canProtocols.GENERIC_STD,
  canProtocols.GENERIC_EXT,
  canProtocols.J1939,
  canProtocols.CANOPEN,
];

export function useDraftForms({
  nodes,
  buses,
  links,
  selectedIds,
  selectedBusIds,
  selectedLinkId,
  singleSelectedNode,
  singleSelectedBus,
  singleSelectedLink,
  activeLinkStyle,
  onApplyNodeDraft,
  onApplyBusDraft,
  onApplyLinkDraft,
}) {
  const isSyncingDraft = ref(false);
  const isSyncingBusDraft = ref(false);
  const isSyncingLinkEditor = ref(false);
  const draftHistoryNodeId = ref(null);
  const busDraftHistoryBusId = ref(null);
  const linkEditorHistoryLinkId = ref(null);

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

  const linkEditor = reactive({
    style: 'polyline',
    protocols: [],
    j1939AddressesInput: '',
    canopenNodeIdsInput: '',
  });

  const formErrors = ref([]);
  const formWarnings = ref([]);

  function normalizeProtocolsList(value) {
    return domainNormalizeProtocolsList(value, SUPPORTED_CAN_PROTOCOLS);
  }

  function normalizeLinkStyle(styleInput) {
    return domainNormalizeLinkStyle(styleInput, LINK_STYLE_OPTIONS);
  }

  function normalizeIntegerList(value) {
    return domainNormalizeIntegerList(value);
  }

  function _findNodeById(id) {
    return nodes.value.find((item) => item.id === id);
  }

  function resolveNodeDefaultProtocols(node) {
    return domainResolveNodeDefaultProtocols(node);
  }

  function resolveLinkDefaultProtocols(link) {
    return domainResolveLinkAllowedProtocols(link, _findNodeById);
  }

  function resolveLinkAllowedProtocols(link) {
    return domainResolveLinkAllowedProtocols(link, _findNodeById);
  }

  function resolveNodeDefaultJ1939Addresses(node) {
    return domainResolveNodeDefaultJ1939Addresses(node);
  }

  function resolveNodeDefaultCanopenNodeIds(node) {
    return domainResolveNodeDefaultCanopenNodeIds(node);
  }

  function resolveLinkAllowedJ1939Addresses(link) {
    return domainResolveLinkAllowedJ1939Addresses(link, _findNodeById);
  }

  function resolveLinkAllowedCanopenNodeIds(link) {
    return domainResolveLinkAllowedCanopenNodeIds(link, _findNodeById);
  }

  function normalizeLinkProtocolsByNode(link, protocolsInput) {
    return domainNormalizeLinkProtocolsByNode(link, protocolsInput, _findNodeById);
  }

  function normalizeLinkJ1939AddressesByNode(link, protocolsInput, addressesInput) {
    return domainNormalizeLinkJ1939AddressesByNode(link, protocolsInput, addressesInput, _findNodeById);
  }

  function normalizeLinkCanopenNodeIdsByNode(link, protocolsInput, addressesInput) {
    return domainNormalizeLinkCanopenNodeIdsByNode(link, protocolsInput, addressesInput, _findNodeById);
  }

  function canLinkUseProtocol(protocol) {
    const link = singleSelectedLink.value;
    if (!link) return true;
    return resolveLinkAllowedProtocols(link).includes(protocol);
  }

  function syncDraftFromSelected() {
    isSyncingDraft.value = true;
    draftHistoryNodeId.value = null;
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
      isSyncingDraft.value = false;
      return;
    }
    draft.name = node.name;
    draft.note = node.note || '';
    draft.protocols = [...node.protocols];
    draft.j1939AddressesInput = node.j1939Addresses.join(', ');
    draft.canopenNodeIdsInput = node.canopenNodeIds.join(', ');
    draft.baseColor = normalizeNodeBaseColor(node.baseColor);
    isSyncingDraft.value = false;
  }

  function syncBusDraftFromSelected() {
    isSyncingBusDraft.value = true;
    busDraftHistoryBusId.value = null;
    const bus = singleSelectedBus.value;
    if (!bus) {
      busDraft.name = '';
      busDraft.baudRate = DEFAULT_BUS_BAUD;
      busDraft.color = BUS_COLOR_POOL[0];
      isSyncingBusDraft.value = false;
      return;
    }
    busDraft.name = bus.name;
    busDraft.baudRate = bus.baudRate;
    busDraft.color = bus.color;
    isSyncingBusDraft.value = false;
  }

  function syncLinkEditorFromSelected() {
    isSyncingLinkEditor.value = true;
    linkEditorHistoryLinkId.value = null;
    const link = singleSelectedLink.value;
    if (!link) {
      linkEditor.style = 'polyline';
      linkEditor.protocols = [];
      linkEditor.j1939AddressesInput = '';
      linkEditor.canopenNodeIdsInput = '';
      isSyncingLinkEditor.value = false;
      return;
    }
    const style = normalizeLinkStyle(link.style);
    const protocols = normalizeLinkProtocolsByNode(link, link.protocols);
    const j1939Addresses = normalizeLinkJ1939AddressesByNode(link, protocols, link.j1939Addresses);
    const canopenNodeIds = normalizeLinkCanopenNodeIdsByNode(link, protocols, link.canopenNodeIds);
    linkEditor.style = style;
    linkEditor.protocols = protocols.length > 0 ? [...protocols] : resolveLinkDefaultProtocols(link);
    linkEditor.j1939AddressesInput = j1939Addresses.join(', ');
    linkEditor.canopenNodeIdsInput = canopenNodeIds.join(', ');
    activeLinkStyle.value = style;
    isSyncingLinkEditor.value = false;
  }

  function toggleDraftProtocol(protocol, checked) {
    if (checked) {
      if (!draft.protocols.includes(protocol)) {
        draft.protocols = [...draft.protocols, protocol];
      }
    } else {
      draft.protocols = draft.protocols.filter((token) => token !== protocol);
    }
  }

  function toggleLinkEditorProtocol(protocol, checked) {
    if (checked) {
      if (!linkEditor.protocols.includes(protocol)) {
        linkEditor.protocols = [...linkEditor.protocols, protocol];
      }
    } else {
      linkEditor.protocols = linkEditor.protocols.filter((token) => token !== protocol);
    }
  }

  function setSelectedLinkStyle(styleInput, options = {}) {
    const link = singleSelectedLink.value;
    if (!link) return;
    const style = normalizeLinkStyle(styleInput);
    link.style = style;
    if (options.syncDraft !== false) {
      syncLinkEditorFromSelected();
    }
    onApplyLinkDraft?.();
  }

  function setSelectedLinkProtocols(protocolsInput, options = {}) {
    const link = singleSelectedLink.value;
    if (!link) return;
    const protocols = normalizeLinkProtocolsByNode(link, protocolsInput);
    const j1939 = normalizeLinkJ1939AddressesByNode(link, protocols, linkEditor.j1939AddressesInput);
    const canopen = normalizeLinkCanopenNodeIdsByNode(link, protocols, linkEditor.canopenNodeIdsInput);
    link.protocols = protocols;
    link.j1939Addresses = j1939;
    link.canopenNodeIds = canopen;
    if (options.syncDraft !== false) {
      syncLinkEditorFromSelected();
    }
    onApplyLinkDraft?.();
  }

  function setSelectedLinkAddresses(j1939AddressesInput, canopenNodeIdsInput, options = {}) {
    const link = singleSelectedLink.value;
    if (!link) return;
    const j1939 = normalizeIntegerList(j1939AddressesInput);
    const canopen = normalizeIntegerList(canopenNodeIdsInput);
    link.j1939Addresses = j1939;
    link.canopenNodeIds = canopen;
    if (options.syncDraft !== false) {
      syncLinkEditorFromSelected();
    }
    onApplyLinkDraft?.();
  }

  function applyActiveStyleToSelectedLink() {
    setSelectedLinkStyle(activeLinkStyle.value);
  }

  function resetDraft() {
    syncDraftFromSelected();
  }

  function describeLinkEndpoint(type, id) {
    if (!id) return '-';
    if (type === 'node') {
      const node = nodes.value.find((item) => item.id === id);
      return node ? `ECU: ${node.name}` : 'ECU: 已删除';
    }
    const bus = buses.value.find((item) => item.id === id);
    return bus ? `CAN BUS: ${bus.name}` : 'CAN BUS: 已删除';
  }

  return {
    draft,
    busDraft,
    linkEditor,
    formErrors,
    formWarnings,
    isSyncingDraft,
    isSyncingBusDraft,
    isSyncingLinkEditor,
    syncDraftFromSelected,
    syncBusDraftFromSelected,
    syncLinkEditorFromSelected,
    toggleDraftProtocol,
    toggleLinkEditorProtocol,
    setSelectedLinkStyle,
    setSelectedLinkProtocols,
    setSelectedLinkAddresses,
    applyActiveStyleToSelectedLink,
    resetDraft,
    normalizeProtocolsList,
    normalizeLinkStyle,
    normalizeIntegerList,
    resolveNodeDefaultProtocols,
    resolveNodeDefaultJ1939Addresses,
    resolveNodeDefaultCanopenNodeIds,
    resolveLinkDefaultProtocols,
    resolveLinkAllowedProtocols,
    resolveLinkAllowedJ1939Addresses,
    resolveLinkAllowedCanopenNodeIds,
    normalizeLinkProtocolsByNode,
    normalizeLinkJ1939AddressesByNode,
    normalizeLinkCanopenNodeIdsByNode,
    canLinkUseProtocol,
    describeLinkEndpoint,
  };
}