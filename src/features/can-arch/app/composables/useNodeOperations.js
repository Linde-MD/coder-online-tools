import { ref, computed } from 'vue';
import { DEFAULT_NODE_BASE_COLOR } from '@/features/can-arch/domain/can-arch-constants.js';
import { nowIso } from '@/features/can-arch/domain/can-arch-topology.js';

export function useNodeOperations({
  nodes,
  links,
  buses,
  selectedIds,
  selectedBusIds,
  selectedLinkId,
  pushHistorySnapshot,
  persistNodes,
  closeContextMenu,
  syncDraftFromSelected,
  syncBusDraftFromSelected,
  syncLinkEditorFromSelected,
  setStatus,
  createNodeName,
  createBusName,
  nextNodePosition,
  nextBusPosition,
  normalizeBusColor,
  ensureUniqueLabel,
  normalizeLinkStyle,
  normalizeProtocolsList,
  normalizeIntegerList,
  BUS_COLOR_POOL,
  DEFAULT_BUS_BAUD,
  NODE_WIDTH,
  NODE_HEIGHT,
  BUS_RADIUS,
  canvasZoom,
  contextMenu,
  getCanvasBounds,
  setBusSelection,
  clearBusSelection,
}) {
  const clipboardPayload = ref(null);
  const pasteSerial = ref(0);

  const hasAnySelectionForDelete = computed(() =>
    selectedIds.value.length > 0 || selectedBusIds.value.length > 0 || !!selectedLinkId.value,
  );

  function selectOnly(nodeId) {
    selectedIds.value = [nodeId];
    clearBusSelection({ sync: false });
    selectedLinkId.value = '';
    syncBusDraftFromSelected();
    syncDraftFromSelected();
  }

  function selectBusOnly(busId) {
    setBusSelection([busId], { sync: false });
    selectedIds.value = [];
    selectedLinkId.value = '';
    syncDraftFromSelected();
    syncBusDraftFromSelected();
  }

  function resolveSpawnPosition(position) {
    if (position instanceof Event) {
      return nextNodePosition();
    }
    const x = Number(position?.x);
    const y = Number(position?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return nextNodePosition();
    }
    return {
      x: Math.max(0, Math.round(x)),
      y: Math.max(0, Math.round(y)),
    };
  }

  function addNode(position) {
    pushHistorySnapshot();
    const spawn = resolveSpawnPosition(position);
    const existingNames = new Set(nodes.value.map((item) => item.name));
    const newNode = {
      id: crypto.randomUUID(),
      name: createNodeName(existingNames),
      note: '',
      position: spawn,
      protocols: [],
      j1939Addresses: [],
      canopenNodeIds: [],
      baseColor: DEFAULT_NODE_BASE_COLOR,
      source: 'manual',
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    nodes.value.push(newNode);
    persistNodes();
    selectOnly(newNode.id);
    setStatus(`已新增节点 ${newNode.name}`);
    closeContextMenu();
  }

  function addBus(position) {
    pushHistorySnapshot();
    const existingNames = new Set(buses.value.map((item) => item.name));
    const spawn = position && Number.isFinite(Number(position.x)) && Number.isFinite(Number(position.y))
      ? { x: Math.round(Number(position.x)), y: Math.round(Number(position.y)) }
      : nextBusPosition();

    const bus = {
      id: crypto.randomUUID(),
      name: createBusName(existingNames),
      baudRate: DEFAULT_BUS_BAUD,
      color: normalizeBusColor(BUS_COLOR_POOL[buses.value.length % BUS_COLOR_POOL.length]),
      position: spawn,
    };

    buses.value.push(bus);
    persistNodes();
    selectBusOnly(bus.id);
    closeContextMenu();
    setStatus(`已新增 CAN BUS：${bus.name}`);
  }

  function addNodeAtContextMenu() {
    const point = contextMenu.value.canvasPoint;
    if (!point) {
      addNode(nextNodePosition());
      return;
    }
    const bounds = getCanvasBounds();
    const logicalWidth = bounds ? Math.floor(bounds.width / canvasZoom.value) : Infinity;
    const logicalHeight = bounds ? Math.floor(bounds.height / canvasZoom.value) : Infinity;
    const maxX = Number.isFinite(logicalWidth) ? Math.max(0, logicalWidth - NODE_WIDTH) : Infinity;
    const maxY = Number.isFinite(logicalHeight) ? Math.max(0, logicalHeight - NODE_HEIGHT) : Infinity;
    addNode({
      x: Math.max(0, Math.min(maxX, Math.round(point.x - NODE_WIDTH / 2))),
      y: Math.max(0, Math.min(maxY, Math.round(point.y - NODE_HEIGHT / 2))),
    });
  }

  function addBusAtContextMenu() {
    const point = contextMenu.value.canvasPoint;
    if (!point) {
      addBus(nextBusPosition());
      return;
    }
    addBus({
      x: Math.round(point.x - BUS_RADIUS),
      y: Math.round(point.y - BUS_RADIUS),
    });
  }

  function deleteSelectedNodes(options = {}) {
    if (selectedIds.value.length === 0) return;
    if (!options.skipHistory) {
      pushHistorySnapshot();
    }
    const selected = new Set(selectedIds.value);
    nodes.value = nodes.value.filter((node) => !selected.has(node.id));
    links.value = links.value.filter((item) => {
      const fromType = item.fromType || 'node';
      const toType = item.toType || 'bus';
      const fromId = item.fromId || item.nodeId;
      const toId = item.toId || item.busId;
      if (fromType === 'node' && selected.has(fromId)) return false;
      if (toType === 'node' && selected.has(toId)) return false;
      return true;
    });
    selectedIds.value = [];
    clearBusSelection({ sync: false });
    selectedLinkId.value = '';
    syncDraftFromSelected();
    syncBusDraftFromSelected();
    persistNodes();
    if (options.skipStatus !== true) {
      setStatus('已删除选中节点。');
    }
    closeContextMenu();
  }

  function deleteSelectedBus(options = {}) {
    if (selectedBusIds.value.length === 0) return;
    if (!options.skipHistory) {
      pushHistorySnapshot();
    }
    const busIdSet = new Set(selectedBusIds.value);
    buses.value = buses.value.filter((item) => !busIdSet.has(item.id));
    links.value = links.value.filter((item) => {
      const fromType = item.fromType || 'node';
      const toType = item.toType || 'bus';
      const fromId = item.fromId || item.nodeId;
      const toId = item.toId || item.busId;
      if (fromType === 'bus' && busIdSet.has(fromId)) return false;
      if (toType === 'bus' && busIdSet.has(toId)) return false;
      return true;
    });
    clearBusSelection({ sync: false });
    selectedLinkId.value = '';
    syncBusDraftFromSelected();
    persistNodes();
    if (options.skipStatus !== true) {
      setStatus('已删除选中 CAN BUS。');
    }
    closeContextMenu();
  }

  function deleteSelectedLink() {
    if (!selectedLinkId.value) return;
    pushHistorySnapshot();
    const id = selectedLinkId.value;
    links.value = links.value.filter((item) => item.id !== id);
    selectedLinkId.value = '';
    persistNodes();
    closeContextMenu();
    syncLinkEditorFromSelected();
    setStatus('已删除连线。');
  }

  function copyCurrentSelection() {
    const nodeSet = new Set(selectedIds.value);
    const busSet = new Set(selectedBusIds.value);

    if (nodeSet.size === 0 && busSet.size === 0) {
      setStatus('请先选中一个或多个模块再复制。', true);
      return;
    }

    const copiedNodes = nodes.value.filter((item) => nodeSet.has(item.id)).map((item) => ({ ...item, position: { ...item.position } }));
    const copiedBuses = buses.value.filter((item) => busSet.has(item.id)).map((item) => ({ ...item, position: { ...item.position } }));
    const copiedLinks = links.value
      .filter((item) => {
        const fromType = item.fromType || 'node';
        const toType = item.toType || 'bus';
        const fromId = item.fromId || item.nodeId;
        const toId = item.toId || item.busId;
        const fromPicked = fromType === 'node' ? nodeSet.has(fromId) : busSet.has(fromId);
        const toPicked = toType === 'node' ? nodeSet.has(toId) : busSet.has(toId);
        return fromPicked && toPicked;
      })
      .map((item) => ({ ...item }));

    clipboardPayload.value = {
      nodes: copiedNodes,
      buses: copiedBuses,
      links: copiedLinks,
    };
    setStatus(`已复制 ${copiedNodes.length} 个 ECU、${copiedBuses.length} 个 BUS。`);
  }

  function pasteClipboard(point = null) {
    const payload = clipboardPayload.value;
    if (!payload || (!payload.nodes?.length && !payload.buses?.length)) {
      setStatus('剪贴板为空，无法粘贴。', true);
      return;
    }

    pasteSerial.value += 1;
    const offset = 28 * pasteSerial.value;
    const allItems = [...payload.nodes, ...payload.buses];
    const minX = Math.min(...allItems.map((item) => item.position.x));
    const minY = Math.min(...allItems.map((item) => item.position.y));
    const shiftX = point ? Math.round(point.x - minX) : offset;
    const shiftY = point ? Math.round(point.y - minY) : offset;

    pushHistorySnapshot();

    const nodeNameSet = new Set(nodes.value.map((item) => item.name));
    const busNameSet = new Set(buses.value.map((item) => item.name));
    const nodeIdMap = new Map();
    const busIdMap = new Map();

    for (const sourceNode of payload.nodes) {
      const id = crypto.randomUUID();
      nodeIdMap.set(sourceNode.id, id);
      nodes.value.push({
        ...sourceNode,
        id,
        name: ensureUniqueLabel(sourceNode.name, nodeNameSet),
        position: {
          x: Math.round(sourceNode.position.x + shiftX),
          y: Math.round(sourceNode.position.y + shiftY),
        },
        createdAt: nowIso(),
        updatedAt: nowIso(),
      });
    }

    for (const sourceBus of payload.buses) {
      const id = crypto.randomUUID();
      busIdMap.set(sourceBus.id, id);
      buses.value.push({
        ...sourceBus,
        id,
        name: ensureUniqueLabel(sourceBus.name, busNameSet),
        position: {
          x: Math.round(sourceBus.position.x + shiftX),
          y: Math.round(sourceBus.position.y + shiftY),
        },
      });
    }

    for (const sourceLink of payload.links) {
      const fromType = sourceLink.fromType || 'node';
      const toType = sourceLink.toType || 'bus';
      const sourceFromId = sourceLink.fromId || sourceLink.nodeId;
      const sourceToId = sourceLink.toId || sourceLink.busId;
      const fromId = fromType === 'node' ? nodeIdMap.get(sourceFromId) : busIdMap.get(sourceFromId);
      const toId = toType === 'node' ? nodeIdMap.get(sourceToId) : busIdMap.get(sourceToId);
      if (!fromId || !toId) continue;
      links.value.push({
        id: crypto.randomUUID(),
        fromType,
        fromId,
        toType,
        toId,
        fromAnchorEdge: sourceLink.fromAnchorEdge || sourceLink.anchorEdge || 'auto',
        fromAnchorOffset: Number.isFinite(Number(sourceLink.fromAnchorOffset)) ? Number(sourceLink.fromAnchorOffset) : (Number.isFinite(Number(sourceLink.anchorOffset)) ? Number(sourceLink.anchorOffset) : 0.5),
        toAnchorEdge: sourceLink.toAnchorEdge || 'auto',
        toAnchorOffset: Number.isFinite(Number(sourceLink.toAnchorOffset)) ? Number(sourceLink.toAnchorOffset) : 0.5,
        style: normalizeLinkStyle(sourceLink.style),
        protocols: normalizeProtocolsList(sourceLink.protocols),
        j1939Addresses: normalizeIntegerList(sourceLink.j1939Addresses),
        canopenNodeIds: normalizeIntegerList(sourceLink.canopenNodeIds),
        anchors: Array.isArray(sourceLink.anchors) ? sourceLink.anchors.map((item) => ({ x: Number(item?.x), y: Number(item?.y) })).filter((item) => Number.isFinite(item.x) && Number.isFinite(item.y)) : [],
      });
    }

    persistNodes();
    setStatus(`已粘贴 ${payload.nodes.length} 个 ECU、${payload.buses.length} 个 BUS。`);
  }

  function pasteAtContextMenu() {
    const point = contextMenu.value.canvasPoint;
    pasteClipboard(point || null);
    closeContextMenu();
  }

  function deleteSelected() {
    if (selectedLinkId.value) {
      deleteSelectedLink();
      return;
    }

    const hasNodeSelection = selectedIds.value.length > 0;
    const busIdsToDelete = [...selectedBusIds.value];
    if (!hasNodeSelection && busIdsToDelete.length === 0) return;

    pushHistorySnapshot();
    if (hasNodeSelection) {
      deleteSelectedNodes({ skipHistory: true, skipStatus: true });
    }
    if (busIdsToDelete.length > 0) {
      setBusSelection(busIdsToDelete, { sync: false });
      deleteSelectedBus({ skipHistory: true, skipStatus: true });
    }
    setStatus('已删除选中对象。');
  }

  return {
    clipboardPayload,
    pasteSerial,
    hasAnySelectionForDelete,
    selectOnly,
    selectBusOnly,
    addNode,
    addBus,
    addNodeAtContextMenu,
    addBusAtContextMenu,
    deleteSelectedNodes,
    deleteSelectedBus,
    deleteSelectedLink,
    copyCurrentSelection,
    pasteClipboard,
    pasteAtContextMenu,
    deleteSelected,
    resolveSpawnPosition,
  };
}