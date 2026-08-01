import { reactive, ref, computed } from 'vue';

export function useCanArchitectureStore({
  initialNodes = [],
  initialBuses = [],
  initialLinks = [],
} = {}) {
  const nodes = ref([...initialNodes]);
  const buses = ref([...initialBuses]);
  const links = ref([...initialLinks]);

  const selectedIds = ref([]);
  const selectedBusIds = ref([]);
  const selectedBusId = ref('');
  const selectedLinkId = ref('');

  const selectedIdSet = computed(() => new Set(selectedIds.value));

  const isFullscreen = ref(false);
  const isSideCollapsed = ref(false);

  const canvasZoom = ref(1);
  const canvasHeight = ref(620);
  const nonFullscreenCanvasHeight = ref(620);

  const activeTopMenu = ref('');
  const activeLinkStyle = ref('polyline');

  const exportPrefs = reactive({
    includeBackground: true,
    autoCrop: true,
  });

  const ecuMessageEditor = reactive({
    active: false,
    ecuId: '',
    ecu: null,
  });

  const editorPanelHeight = ref(620);

  const singleSelectedNode = computed(() => {
    if (selectedIds.value.length !== 1) return null;
    return nodes.value.find((item) => item.id === selectedIds.value[0]) || null;
  });

  const singleSelectedBus = computed(() => {
    if (selectedBusIds.value.length !== 1) return null;
    return buses.value.find((item) => item.id === selectedBusIds.value[0]) || null;
  });

  const singleSelectedLink = computed(() => {
    if (!selectedLinkId.value) return null;
    return links.value.find((item) => item.id === selectedLinkId.value) || null;
  });

  const sidePanelTitle = computed(() => {
    if (singleSelectedLink.value) return '连线属性面板';
    if (singleSelectedBus.value) return 'CAN BUS 属性面板';
    return 'ECU 属性面板';
  });

  const hasAnySelectionForDelete = computed(() => {
    if (ecuMessageEditor.active) {
      return Boolean(ecuMessageEditorRef.value?.hasSelection);
    }
    return Boolean(selectedLinkId.value) || selectedIds.value.length > 0 || selectedBusIds.value.length > 0;
  });

  const hasAnySelectionForExport = computed(() => {
    return Boolean(selectedLinkId.value) || selectedIds.value.length > 0 || selectedBusIds.value.length > 0;
  });

  const ecuMessageEditorBusTabs = computed(() => {
    if (!ecuMessageEditor.active || !ecuMessageEditor.ecuId) return [];
    const currentNode = nodes.value.find((item) => item.id === ecuMessageEditor.ecuId);
    if (!currentNode) return [];
    const tabs = [];
    for (const bus of buses.value) {
      const peerIds = new Set();
      for (const link of links.value) {
        const linkBusId = resolveLinkBusId(link);
        if (linkBusId !== bus.id) continue;
        const linkNodeId = resolveLinkNodeId(link);
        if (!linkNodeId) continue;
        if (linkNodeId === currentNode.id) continue;
        const peer = nodes.value.find((item) => item.id === linkNodeId);
        if (!peer) continue;
        peerIds.add(peer.id);
      }

      const connectedToBus = links.value.some((link) => resolveLinkBusId(link) === bus.id && resolveLinkNodeId(link) === currentNode.id);
      if (!connectedToBus) continue;

      tabs.push({
        busId: bus.id,
        busName: bus.name,
        peers: [...peerIds].map((id) => {
          const peer = nodes.value.find((item) => item.id === id);
          return { id, name: peer?.name || id };
        }),
      });
    }
    return tabs;
  });

  const canAddAnchorInContextMenu = computed(() => {
    if (contextMenu.value.target !== 'link') return false;
    const linkId = contextMenu.value.linkId || selectedLinkId.value;
    if (!linkId) return false;
    const link = links.value.find((item) => item.id === linkId);
    return link?.style === 'polyline';
  });

  function resolveLinkBusId(link) {
    return link.busId || (link.toType === 'bus' ? link.toId : link.fromType === 'bus' ? link.fromId : '');
  }

  function resolveLinkNodeId(link) {
    return link.nodeId || (link.fromType === 'node' ? link.fromId : link.toType === 'node' ? link.toId : '');
  }

  return {
    nodes,
    buses,
    links,
    selectedIds,
    selectedBusIds,
    selectedBusId,
    selectedLinkId,
    selectedIdSet,
    isFullscreen,
    isSideCollapsed,
    canvasZoom,
    canvasHeight,
    nonFullscreenCanvasHeight,
    activeTopMenu,
    activeLinkStyle,
    exportPrefs,
    ecuMessageEditor,
    editorPanelHeight,
    singleSelectedNode,
    singleSelectedBus,
    singleSelectedLink,
    sidePanelTitle,
    hasAnySelectionForDelete,
    hasAnySelectionForExport,
    ecuMessageEditorBusTabs,
    canAddAnchorInContextMenu,
    resolveLinkBusId,
    resolveLinkNodeId,
  };
}