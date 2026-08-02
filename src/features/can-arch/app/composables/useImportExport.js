import { ref } from 'vue';

export function useImportExport({
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
  pendingDbcExport,
  dbcExportSelection,
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
  nextNodePosition,
  nextBusPosition,
  nodeWidth,
  nodeHeight,
}) {
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

  function mergeProjection(map, node, protocolsInput, j1939Input, canopenInput) {
    if (!node?.id) return;
    if (!map.has(node.id)) {
      map.set(node.id, {
        node,
        protocols: new Set(),
        j1939Addresses: new Set(),
        canopenNodeIds: new Set(),
      });
    }
    const entry = map.get(node.id);
    const protocols = normalizeProtocolsList(protocolsInput);
    const j1939Addresses = normalizeIntegerList(j1939Input);
    const canopenNodeIds = normalizeIntegerList(canopenInput);
    for (const protocol of protocols) {
      entry.protocols.add(protocol);
    }
    for (const address of j1939Addresses) {
      entry.j1939Addresses.add(address);
    }
    for (const nodeId of canopenNodeIds) {
      entry.canopenNodeIds.add(nodeId);
    }
  }

  function buildProjectionFromNode(map, node) {
    if (!node) return;
    const protocols = resolveNodeDefaultProtocols(node);
    const j1939Addresses = protocols.includes(canProtocols.J1939)
      ? resolveNodeDefaultJ1939Addresses(node)
      : [];
    const canopenNodeIds = protocols.includes(canProtocols.CANOPEN)
      ? resolveNodeDefaultCanopenNodeIds(node)
      : [];
    mergeProjection(map, node, protocols, j1939Addresses, canopenNodeIds);
  }

  function buildProjectionFromLink(map, link) {
    if (!link) return;
    const nodeId = resolveLinkNodeId(link);
    if (!nodeId) return;
    const node = nodes.value.find((item) => item.id === nodeId);
    if (!node) return;
    const storedProtocols = normalizeProtocolsList(link.protocols);
    const protocols = storedProtocols.length > 0
      ? normalizeLinkProtocolsByNode(link, storedProtocols)
      : resolveLinkDefaultProtocols(link);
    let j1939Addresses = normalizeLinkJ1939AddressesByNode(link, protocols, link.j1939Addresses);
    let canopenNodeIds = normalizeLinkCanopenNodeIdsByNode(link, protocols, link.canopenNodeIds);
    if (storedProtocols.length === 0 && protocols.includes(canProtocols.J1939) && j1939Addresses.length === 0) {
      j1939Addresses = resolveLinkAllowedJ1939Addresses(link);
    }
    if (storedProtocols.length === 0 && protocols.includes(canProtocols.CANOPEN) && canopenNodeIds.length === 0) {
      canopenNodeIds = resolveLinkAllowedCanopenNodeIds(link);
    }
    mergeProjection(map, node, protocols, j1939Addresses, canopenNodeIds);
  }

  function finalizeProjectionMap(projections) {
    return [...projections.values()].map((entry) => {
      const protocols = [...entry.protocols];
      const finalProtocols = protocols.length > 0 ? protocols : [canProtocols.GENERIC_STD];
      const includesJ1939 = finalProtocols.includes(canProtocols.J1939);
      const includesCanopen = finalProtocols.includes(canProtocols.CANOPEN);
      return {
        ...entry.node,
        protocols: finalProtocols,
        j1939Addresses: includesJ1939 ? [...entry.j1939Addresses] : [],
        canopenNodeIds: includesCanopen ? [...entry.canopenNodeIds] : [],
      };
    });
  }

  function sanitizeFilenamePart(value) {
    const normalized = String(value || '')
      .trim()
      .replace(/[\\/:*?"<>|]+/g, '-')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    return normalized || 'bus';
  }

  function downgradeJ1939NodesToStandard(nodesInput) {
    const list = Array.isArray(nodesInput) ? nodesInput : [];
    return list.map((node) => ({
      ...node,
      protocols: [canProtocols.GENERIC_EXT],
      j1939Addresses: [],
      canopenNodeIds: [],
    }));
  }

  function mergeStandardExportNodes(baseNodes, addonNodes) {
    const merged = new Map();
    const pushNode = (node) => {
      if (!node?.id) return;
      if (!merged.has(node.id)) {
        merged.set(node.id, {
          ...node,
          protocols: normalizeProtocolsList(node.protocols),
          j1939Addresses: [],
          canopenNodeIds: normalizeIntegerList(node.canopenNodeIds),
        });
        return;
      }
      const current = merged.get(node.id);
      current.protocols = [...new Set([
        ...normalizeProtocolsList(current.protocols),
        ...normalizeProtocolsList(node.protocols),
      ])];
      current.canopenNodeIds = [...new Set([
        ...normalizeIntegerList(current.canopenNodeIds),
        ...normalizeIntegerList(node.canopenNodeIds),
      ])];
    };
    for (const node of Array.isArray(baseNodes) ? baseNodes : []) {
      pushNode(node);
    }
    for (const node of Array.isArray(addonNodes) ? addonNodes : []) {
      pushNode(node);
    }
    return [...merged.values()].map((node) => ({
      ...node,
      protocols: node.protocols.length > 0 ? node.protocols : [canProtocols.GENERIC_STD],
    }));
  }

  function buildExportNodeProjections() {
    const projections = new Map();
    const selectedNodeSet = new Set(selectedIds.value);
    for (const node of nodes.value) {
      if (!selectedNodeSet.has(node.id)) continue;
      buildProjectionFromNode(projections, node);
    }
    if (selectedLinkId.value) {
      const link = links.value.find((item) => item.id === selectedLinkId.value);
      buildProjectionFromLink(projections, link);
    }
    if (selectedBusIds.value.length > 0) {
      const busSet = new Set(selectedBusIds.value);
      for (const link of links.value) {
        if (!busSet.has(resolveLinkBusId(link))) continue;
        buildProjectionFromLink(projections, link);
      }
    }
    return finalizeProjectionMap(projections);
  }

  function collectExportCandidateBusIds() {
    const busSet = new Set();
    const ordered = [];
    const pushBusId = (busId) => {
      if (!busId || busSet.has(busId)) return;
      if (!buses.value.find((item) => item.id === busId)) return;
      busSet.add(busId);
      ordered.push(busId);
    };
    for (const busId of selectedBusIds.value) {
      pushBusId(busId);
    }
    if (selectedLinkId.value) {
      const link = links.value.find((item) => item.id === selectedLinkId.value);
      pushBusId(resolveLinkBusId(link));
    }
    if (selectedIds.value.length > 0) {
      const selectedNodeSet = new Set(selectedIds.value);
      for (const link of links.value) {
        const nodeId = resolveLinkNodeId(link);
        if (!selectedNodeSet.has(nodeId)) continue;
        pushBusId(resolveLinkBusId(link));
      }
    }
    return ordered;
  }

  function buildExportNodeProjectionsForBus(busId) {
    if (!busId) return [];
    const projections = new Map();
    const selectedNodeSet = new Set(selectedIds.value);
    const selectedBusSet = new Set(selectedBusIds.value);
    const selectedLink = selectedLinkId.value
      ? links.value.find((item) => item.id === selectedLinkId.value)
      : null;
    for (const link of links.value) {
      const linkBusId = resolveLinkBusId(link);
      if (linkBusId !== busId) continue;
      const linkNodeId = resolveLinkNodeId(link);
      const fromSelectedBus = selectedBusSet.has(busId);
      const fromSelectedNode = selectedNodeSet.has(linkNodeId);
      const fromSelectedLink = Boolean(selectedLink && selectedLink.id === link.id);
      if (!fromSelectedBus && !fromSelectedNode && !fromSelectedLink) continue;
      buildProjectionFromLink(projections, link);
    }
    for (const node of nodes.value) {
      if (!selectedNodeSet.has(node.id)) continue;
      const touchesBus = links.value.some((link) => resolveLinkNodeId(link) === node.id && resolveLinkBusId(link) === busId);
      if (!touchesBus) continue;
      if (!projections.has(node.id)) {
        buildProjectionFromNode(projections, node);
      }
    }
    return finalizeProjectionMap(projections);
  }

  function buildDbcExportBusGroups() {
    const busIds = collectExportCandidateBusIds();
    const groups = [];
    for (const busId of busIds) {
      const bus = buses.value.find((item) => item.id === busId);
      if (!bus) continue;
      const exportNodes = buildExportNodeProjectionsForBus(busId);
      if (exportNodes.length === 0) continue;
      const { j1939Nodes, otherNodes } = splitExportNodesByProtocol(exportNodes);

      const messagesByNode = {};
      for (const node of exportNodes) {
        const workspace = node?.messageWorkspace;
        if (!workspace || typeof workspace !== 'object') continue;
        const store = workspace[busId];
        if (!store || typeof store !== 'object') continue;
        const rxMessages = Array.isArray(store.rxMessages) ? store.rxMessages : [];
        const txMessages = Array.isArray(store.txMessages) ? store.txMessages : [];
        if (rxMessages.length > 0 || txMessages.length > 0) {
          messagesByNode[node.id] = { rxMessages, txMessages };
        }
      }

      groups.push({
        busId,
        busName: bus.name,
        exportNodes,
        j1939Nodes,
        otherNodes,
        nodeCount: exportNodes.length,
        j1939Count: j1939Nodes.length,
        otherCount: otherNodes.length,
        hasJ1939: j1939Nodes.length > 0,
        hasOthers: otherNodes.length > 0,
        requiresProtocolSelection: j1939Nodes.length > 0 && otherNodes.length > 0,
        selected: true,
        j1939Mode: 'dedicated',
        messagesByNode,
      });
    }
    return groups;
  }

  function executeDbcExport(nodes, options = {}) {
    const j1939Mode = options.j1939Mode === 'downgrade' ? 'downgrade' : 'dedicated';
    const silentStatus = options.silentStatus === true;
    const dateTag = options.dateTag || new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const filenameBase = options.filenameBase || `can-arch-nodes-${dateTag}`;

    const safeNodes = Array.isArray(nodes) ? nodes : [];
    if (safeNodes.length === 0) {
      if (!silentStatus) {
        setStatus('没有可导出的 ECU。', true);
      }
      return null;
    }

    const exportNodes = safeNodes.map((node) => {
      if (j1939Mode === 'downgrade') {
        const protocols = normalizeProtocolsList(node.protocols);
        const downgraded = protocols.map((p) =>
          p === canProtocols.J1939 ? canProtocols.GENERIC_EXT : p
        );
        return {
          ...node,
          protocols: downgraded,
          j1939Addresses: [],
        };
      }
      return node;
    });

    const dbc = serializeNodesToDbc(exportNodes, { profile: 'standard', messagesByNode: options.messagesByNode });
    downloadTextFile(`${filenameBase}.dbc`, dbc);

    const uniqueNodeIds = new Set(exportNodes.map((item) => item.id));
    if (!silentStatus) {
      const msgCount = options.messagesByNode
        ? Object.values(options.messagesByNode).reduce((sum, store) => {
            const rx = Array.isArray(store?.rxMessages) ? store.rxMessages.length : 0;
            const tx = Array.isArray(store?.txMessages) ? store.txMessages.length : 0;
            return sum + rx + tx;
          }, 0)
        : 0;
      const modeDesc = j1939Mode === 'downgrade' ? '（J1939 已降级为标准扩展帧）' : '';
      const msgDesc = msgCount > 0 ? `，${msgCount} 条报文` : '';
      setStatus(`已导出 1 个 DBC 文件${modeDesc}，覆盖 ${uniqueNodeIds.size} 个 ECU${msgDesc}。`);
    }

    return {
      exportedFiles: 1,
      exportedNodeIds: [...uniqueNodeIds],
    };
  }

  function openDbcExportForBusGroups(groups) {
    pendingDbcExport.value = {
      mode: 'bus-groups',
      busGroups: groups.map((group) => ({ ...group })),
      j1939Nodes: [],
      otherNodes: [],
    };
    importModalOpen.value = false;
    importStage.value = 'choose';
    setStatus('已打开 CAN BUS 分组 DBC 导出。');
  }

  function openDbcExportForProtocolSplit(originalNodes, j1939Nodes, otherNodes, messagesByNode) {
    pendingDbcExport.value = {
      mode: 'protocol-split',
      busGroups: [],
      originalNodes,
      j1939Nodes,
      otherNodes,
      messagesByNode: messagesByNode || {},
    };
    importModalOpen.value = false;
    importStage.value = 'choose';
  }

  function closeDbcExportModal() {
    pendingDbcExport.value = {
      mode: 'idle',
      busGroups: [],
      originalNodes: [],
      j1939Nodes: [],
      otherNodes: [],
    };
  }

  function confirmDbcExportSelection() {
    if (pendingDbcExport.value.busGroups.length > 0) {
      const selectedGroups = pendingDbcExport.value.busGroups.filter((group) => group.selected);
      if (selectedGroups.length === 0) {
        setStatus('请至少勾选一个 CAN BUS 导出。', true);
        return;
      }
      const dateTag = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      let exportedFiles = 0;
      const exportedNodeIds = new Set();
      for (const group of selectedGroups) {
        const filenameBase = `can-arch-${sanitizeFilenamePart(group.busName)}-${dateTag}`;
        const result = executeDbcExport(group.exportNodes, {
          j1939Mode: group.j1939Mode,
          silentStatus: true,
          filenameBase,
          dateTag,
          messagesByNode: group.messagesByNode,
        });
        if (!result) continue;
        exportedFiles += result.exportedFiles;
        for (const nodeId of result.exportedNodeIds) {
          exportedNodeIds.add(nodeId);
        }
      }
      if (exportedFiles === 0) {
        setStatus('勾选的 CAN BUS 在当前协议组合下没有可导出内容。', true);
        return;
      }
      setStatus(`已按 ${selectedGroups.length} 个 CAN BUS 导出 ${exportedFiles} 个 DBC 文件，覆盖 ${exportedNodeIds.size} 个 ECU。`);
      closeDbcExportModal();
      return;
    }
    const result = executeDbcExport(
      pendingDbcExport.value.originalNodes,
      {
        j1939Mode: dbcExportSelection.value.j1939Mode,
        messagesByNode: pendingDbcExport.value.messagesByNode,
      }
    );
    if (!result) return;
    closeDbcExportModal();
  }

  function exportSelectedNodes() {
    const busGroups = buildDbcExportBusGroups();
    if (busGroups.length > 1) {
      openDbcExportForBusGroups(busGroups);
      return;
    }
    if (busGroups.length === 1) {
      const [group] = busGroups;
      if (group.hasJ1939) {
        openDbcExportForProtocolSplit(group.exportNodes, group.j1939Nodes, group.otherNodes);
        return;
      }
      executeDbcExport(group.exportNodes, {
        j1939Mode: 'dedicated',
      });
      return;
    }
    const exportNodes = buildExportNodeProjections();
    if (exportNodes.length === 0) {
      setStatus('请先选中至少一个 ECU、CAN BUS 或连线再导出。', true);
      return;
    }
    const { j1939Nodes, otherNodes } = splitExportNodesByProtocol(exportNodes);
    if (j1939Nodes.length > 0) {
      openDbcExportForProtocolSplit(exportNodes, j1939Nodes, otherNodes);
      return;
    }
    executeDbcExport(exportNodes, {
      j1939Mode: 'dedicated',
    });
  }

  return {
    buildExportNodeProjections,
    collectExportCandidateBusIds,
    buildExportNodeProjectionsForBus,
    buildDbcExportBusGroups,
    executeDbcExport,
    openDbcExportForBusGroups,
    openDbcExportForProtocolSplit,
    closeDbcExportModal,
    confirmDbcExportSelection,
    exportSelectedNodes,
    sanitizeFilenamePart,
  };
}