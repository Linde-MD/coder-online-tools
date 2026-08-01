import { computed, reactive, ref } from 'vue';
import { createTopologyStore } from '@/features/can-arch/app/composables/useTopologyStore.js';
import { useStatusBar } from '@/features/can-arch/app/composables/useStatusBar.js';
import { useHistoryManager } from '@/features/can-arch/app/composables/useHistoryManager.js';
import { useContextMenuState } from '@/features/can-arch/app/composables/useContextMenuState.js';
import { useCanvasResize } from '@/features/can-arch/app/composables/useCanvasResize.js';
import { useEditorNavigation } from '@/features/can-arch/app/composables/useEditorNavigation.js';
import { useAutoSave } from '@/features/can-arch/app/composables/useAutoSave.js';
import { useEditorDraft } from '@/features/can-arch/app/composables/useEditorDraft.js';
import { useImportExport } from '@/features/can-arch/app/composables/useImportExport.js';

export function useCanArchApp({
  canvasRef,
  ecuMessageEditorRef,
  importInputRef,
  configImportInputRef,
  constants: {
    NODE_WIDTH,
    NODE_HEIGHT,
    BUS_RADIUS,
    DEFAULT_NODE_BASE_COLOR,
    DEFAULT_BUS_BAUD,
    BUS_COLOR_POOL,
    AUTO_SAVE_INTERVAL_MS,
  },
  domain: {
    normalizeBusColor,
    normalizeNodeBaseColor,
    normalizeProtocolsList,
    normalizeIntegerList,
    normalizeLinkStyle,
    canProtocols,
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
    pruneNodeConnectedLinkCapabilities,
    splitExportNodesByProtocol,
    createNodeName,
    createBusName,
    ensureUniqueLabel,
    nowIso,
  },
  services: {
    parseDbcNodes,
    downloadTextFile,
    downloadBlobFile,
    buildArchitectureSvg,
    exportArchitecturePng,
    buildTimestampTag,
    serializeNodesToDbc,
    buildImportCandidatesFromParsed,
    resolveCandidateMergeNodeName,
  },
  geometry: {
    getCanvasBounds,
  },
  config: {
    CONFIG_VERSION,
  },
}) {
  const { statusMessage, statusError, setStatus } = useStatusBar();

  const topology = createTopologyStore({
    nextNodePosition: () => nextNodePosition(),
    nextBusPosition: () => nextBusPosition(),
    onStatus: setStatus,
  });

  const {
    nodes,
    buses,
    links,
    selection: { selectedIds, selectedBusIds, selectedBusId, selectedLinkId },
    flags: { isFullscreen, isSideCollapsed, canvasZoom, canvasHeight, nonFullscreenCanvasHeight, activeTopMenu, activeLinkStyle, exportPrefs },
    editor: { ecuMessageEditor, editorPanelHeight },
    computed: { selectedIdSet, singleSelectedNode, singleSelectedBus, singleSelectedLink, sidePanelTitle, hasAnySelectionForDelete, hasAnySelectionForExport, ecuMessageEditorBusTabs, canAddAnchorInContextMenu },
    ops: { pushHistorySnapshot, undoNodes, redoNodes, persist: persistNodes, loadNodes, exportArchitectureConfig, importConfigPayload, canUndo, canRedo },
  } = topology;

  const {
    historyPast,
    historyFuture,
    historySuspend,
    canUndo: canUndoComputed,
    canRedo: canRedoComputed,
    takeTopologySnapshot,
  } = useHistoryManager({
    nodes,
    buses,
    links,
    selectedIds,
    clearBusSelection: topology.clearBusSelection,
    selectedLinkId,
    syncDraftFromSelected: () => {},
    syncBusDraftFromSelected: () => {},
    persistNodes,
    setStatus,
    nextNodePosition: () => nextNodePosition(),
    nextBusPosition: () => nextBusPosition(),
  });

  const {
    contextMenu,
    closeContextMenu,
    openContextMenuAt,
    openCanvasContextMenu,
    onNodeContextMenu,
    onBusContextMenu,
  } = useContextMenuState({ setStatus });

  const {
    onCanvasResizePointerDown,
  } = useCanvasResize({
    isFullscreen,
    canvasHeight,
    editorPanelHeight,
    ecuMessageEditor,
    ecuMessageEditorRef,
    setStatus,
  });

  const {
    openEcuMessageEditor,
    closeEcuMessageEditor,
    switchEcuInEditor,
    toggleFullscreen,
  } = useEditorNavigation({
    isFullscreen,
    canvasHeight,
    editorPanelHeight,
    canvasRef,
    ecuMessageEditorRef,
    ecuMessageEditor,
    nodes,
    magneticHeader: ref(false),
    isHeaderPeeking: ref(false),
    setStatus,
    getCanvasBounds: geometry.getCanvasBounds,
    syncFullscreenCanvasHeight: () => {},
  });

  const { startAutoSaveTimer, stopAutoSaveTimer } = useAutoSave({ persistNodes });

  const importModalOpen = ref(false);
  const importStage = ref('choose');
  const importCandidates = ref([]);
  const importTarget = reactive({
    connectionMode: 'existing',
    busId: '',
    newBusName: '',
  });
  const importReviewState = reactive({
    newExpanded: true,
    conflictExpanded: true,
  });
  const configImportInputLocalRef = configImportInputRef || ref(null);

  const draftApi = useEditorDraft({
    singleSelectedNode,
    singleSelectedBus,
    normalizeBusColor,
    normalizeNodeBaseColor,
    DEFAULT_NODE_BASE_COLOR,
    DEFAULT_BUS_BAUD,
    BUS_COLOR_POOL,
    validateCanNodeDraft: services.validateCanNodeDraft,
    pushHistorySnapshot,
    persistNodes,
    setStatus,
    nowIso,
    pruneNodeConnectedLinkCapabilities,
  });

  const importExportApi = useImportExport({
    nodes,
    buses,
    links,
    selectedIds,
    selectedBusIds,
    selectedLinkId,
    selectedBusId,
    importInputRef,
    importModalOpen,
    importStage,
    importCandidates,
    importTarget,
    importReviewState,
    pendingDbcExport: ref({ mode: 'idle', busGroups: [], j1939Nodes: [], otherNodes: [] }),
    dbcExportSelection: reactive({ includeJ1939: true, includeOthers: true, j1939Mode: 'dedicated' }),
    pushHistorySnapshot,
    persistNodes,
    setStatus,
    nowIso,
    createBusName,
    BUS_COLOR_POOL,
    downloadTextFile,
    serializeNodesToDbc,
    normalizeProtocolsList,
    normalizeIntegerList,
    normalizeLinkProtocolsByNode,
    normalizeLinkJ1939AddressesByNode,
    normalizeLinkCanopenNodeIdsByNode,
    resolveNodeDefaultProtocols,
    resolveNodeDefaultJ1939Addresses,
    resolveNodeDefaultCanopenNodeIds,
    resolveLinkDefaultProtocols,
    resolveLinkAllowedJ1939Addresses,
    resolveLinkAllowedCanopenNodeIds,
    splitExportNodesByProtocol,
    canProtocols,
    nextNodePosition: () => nextNodePosition(),
    nextBusPosition: () => nextBusPosition(),
    nodeWidth: NODE_WIDTH,
    nodeHeight: NODE_HEIGHT,
  });

  function nextNodePosition() {
    const baseX = 20;
    const baseY = 20;
    const stepX = 18;
    const stepY = 14;
    function occupiedByAnchor(candidate) {
      return nodes.value.some((node) => (
        Math.abs(node.position.x - candidate.x) < 12 &&
        Math.abs(node.position.y - candidate.y) < 12
      ));
    }
    for (let i = 0; i < 14; i += 1) {
      const candidate = { x: baseX + i * stepX, y: baseY + i * stepY };
      if (!occupiedByAnchor(candidate)) return candidate;
    }
    return { x: baseX, y: baseY };
  }

  function nextBusPosition() {
    const baseX = 80;
    const baseY = 40;
    const stepX = 92;
    const stepY = 18;
    for (let i = 0; i < 12; i += 1) {
      const candidate = { x: baseX + i * stepX, y: baseY + i * stepY };
      const occupied = buses.value.some((bus) => (
        Math.abs(bus.position.x - candidate.x) < BUS_RADIUS * 2 &&
        Math.abs(bus.position.y - candidate.y) < BUS_RADIUS * 2
      ));
      if (!occupied) return candidate;
    }
    return { x: baseX, y: baseY };
  }

  function resolveLinkNodeId(link) {
    const fromType = link?.fromType || 'node';
    const toType = link?.toType || 'bus';
    const fromId = link?.fromId || link?.nodeId;
    const toId = link?.toId || link?.busId;
    if (fromType === 'node') return fromId;
    if (toType === 'node') return toId;
    return '';
  }

  function resolveLinkBusId(link) {
    const fromType = link?.fromType || 'node';
    const toType = link?.toType || 'bus';
    const fromId = link?.fromId || link?.nodeId;
    const toId = link?.toId || link?.busId;
    if (fromType === 'bus') return fromId;
    if (toType === 'bus') return toId;
    return '';
  }

  const floatingStatusText = computed(() => {
    if (statusError.value) return statusError.value;
    return statusMessage.value;
  });

  const resolvedLinks = computed(() => {
    const geometries = [];
    for (const link of links.value) {
      const fromType = link.fromType || 'node';
      const toType = link.toType || 'bus';
      const fromId = link.fromId || link.nodeId;
      const toId = link.toId || link.busId;
      const fromModule = fromType === 'node'
        ? nodes.value.find((item) => item.id === fromId)
        : buses.value.find((item) => item.id === fromId);
      const toModule = toType === 'node'
        ? nodes.value.find((item) => item.id === toId)
        : buses.value.find((item) => item.id === toId);
      if (!fromModule || !toModule) continue;

      const fromCenter = fromType === 'node'
        ? { x: fromModule.position.x + NODE_WIDTH / 2, y: fromModule.position.y + NODE_HEIGHT / 2 }
        : { x: fromModule.position.x + BUS_RADIUS, y: fromModule.position.y + BUS_RADIUS };
      const toCenter = toType === 'node'
        ? { x: toModule.position.x + NODE_WIDTH / 2, y: toModule.position.y + NODE_HEIGHT / 2 }
        : { x: toModule.position.x + BUS_RADIUS, y: toModule.position.y + BUS_RADIUS };

      const style = normalizeLinkStyle(link.style);

      geometries.push({
        id: link.id,
        fromType,
        fromId,
        toType,
        toId,
        style,
        color: '#395f89',
        start: fromCenter,
        end: toCenter,
      });
    }
    return geometries;
  });

  const nodeLinkDots = computed(() => (node) => {
    const dots = [];
    for (const link of resolvedLinks.value) {
      if (link.fromType === 'node' && link.fromId === node.id) {
        dots.push(link.start);
      }
      if (link.toType === 'node' && link.toId === node.id) {
        dots.push(link.end);
      }
    }
    return dots;
  });

  const sceneSize = computed(() => {
    let maxX = 420;
    let maxY = 420;
    for (const node of nodes.value) {
      maxX = Math.max(maxX, Math.round(node.position.x + NODE_WIDTH + 40));
      maxY = Math.max(maxY, Math.round(node.position.y + NODE_HEIGHT + 40));
    }
    for (const bus of buses.value) {
      maxX = Math.max(maxX, Math.round(bus.position.x + BUS_RADIUS * 2 + 40));
      maxY = Math.max(maxY, Math.round(bus.position.y + BUS_RADIUS * 2 + 40));
    }
    return { width: Math.max(420, maxX), height: Math.max(420, maxY) };
  });

  const sceneViewportSize = computed(() => ({
    width: Math.max(420, Math.round(sceneSize.value.width * canvasZoom.value)),
    height: Math.max(420, Math.round(sceneSize.value.height * canvasZoom.value)),
  }));

  const linkHoverNodeEdge = reactive({ nodeId: '', edge: '' });
  const linkHoverBusId = ref('');
  const linkDraftTarget = ref(null);
  const linkDraftVersion = ref(0);
  let dragState = null;
  let canvasResizeState = null;
  let busDragState = null;
  let linkDraftState = null;
  let linkAnchorDragState = null;
  let deleteKeyBound = false;
  let draftApplyTimerId = null;
  let busDraftApplyTimerId = null;
  let isSyncingLinkEditor = false;
  let linkEditorHistoryLinkId = null;

  const linkEditor = reactive({
    style: 'polyline',
    protocols: [],
    j1939AddressesInput: '',
    canopenNodeIdsInput: '',
  });

  const panelClassList = computed(() => ({
    active: false,
    'is-fullscreen': isFullscreen.value,
    'side-collapsed': isSideCollapsed.value,
  }));

  function hideSideCard() {
    isSideCollapsed.value = true;
  }

  function showSideCard() {
    isSideCollapsed.value = false;
  }

  function toggleTopMenu(menuName) {
    activeTopMenu.value = activeTopMenu.value === menuName ? '' : menuName;
  }

  function closeTopMenu() {
    activeTopMenu.value = '';
  }

  function runMenuAction(action) {
    closeTopMenu();
    action?.();
  }

  return {
    state: {
      nodes, buses, links,
      selectedIds, selectedBusIds, selectedBusId, selectedLinkId,
      selectedIdSet,
      isFullscreen, isSideCollapsed,
      canvasZoom, canvasHeight, nonFullscreenCanvasHeight,
      activeTopMenu, activeLinkStyle,
      exportPrefs, ecuMessageEditor, editorPanelHeight,
      statusMessage, statusError,
      contextMenu,
      importModalOpen, importStage, importCandidates, importTarget, importReviewState,
      historyPast, historyFuture, historySuspend,
      draft: draftApi.draft,
      busDraft: draftApi.busDraft,
      linkEditor,
      linkHoverNodeEdge, linkHoverBusId, linkDraftTarget, linkDraftVersion,
      panelClassList,
      floatingStatusText,
      sceneSize, sceneViewportSize,
      resolvedLinks,
      ecuMessageEditorBusTabs,
      canAddAnchorInContextMenu,
    },
    computed: {
      singleSelectedNode,
      singleSelectedBus,
      singleSelectedLink,
      sidePanelTitle,
      canUndo: canUndoComputed,
      canRedo: canRedoComputed,
      hasAnySelectionForDelete,
      hasAnySelectionForExport,
    },
    refs: {
      canvasRef,
      ecuMessageEditorRef,
      importInputRef,
      configImportInputRef: configImportInputLocalRef,
    },
    navigation: {
      openEcuMessageEditor,
      closeEcuMessageEditor,
      switchEcuInEditor,
      toggleFullscreen,
      hideSideCard,
      showSideCard,
      toggleTopMenu,
      closeTopMenu,
      runMenuAction,
    },
    history: {
      canUndo: canUndoComputed,
      canRedo: canRedoComputed,
      undoNodes,
      redoNodes,
      pushHistorySnapshot,
      takeTopologySnapshot,
    },
    contextMenu: {
      contextMenu,
      closeContextMenu,
      openContextMenuAt,
      openCanvasContextMenu,
      onNodeContextMenu,
      onBusContextMenu,
    },
    canvas: {
      onCanvasResizePointerDown,
      nextNodePosition,
      nextBusPosition,
      resolveLinkNodeId,
      resolveLinkBusId,
      nodeLinkDots,
      dragState,
      canvasResizeState,
      busDragState,
      linkDraftState,
      linkAnchorDragState,
      deleteKeyBound,
      draftApplyTimerId,
      busDraftApplyTimerId,
      isSyncingLinkEditor,
      linkEditorHistoryLinkId,
      bumpLinkDraftVersion: () => { linkDraftVersion.value += 1; },
    },
    draft: {
      ...draftApi,
    },
    importExport: {
      ...importExportApi,
    },
    lifecycle: {
      startAutoSaveTimer,
      stopAutoSaveTimer,
      loadNodes,
      persistNodes,
      setStatus,
      nowIso,
    },
    editor: {
      openEcuMessageEditor,
      closeEcuMessageEditor,
      switchEcuInEditor,
    },
    templates: {
      getCanvasBounds: geometry.getCanvasBounds,
      buildNodeCardStyle: (node) => ({}),
      buildBusCardStyle: (bus) => ({}),
    },
    helpers: {
      normalizeBusColor,
      normalizeNodeBaseColor,
      normalizeProtocolsList,
      normalizeIntegerList,
      normalizeLinkStyle,
      sanitizeFilenamePart: importExportApi.sanitizeFilenamePart,
    },
  };
}