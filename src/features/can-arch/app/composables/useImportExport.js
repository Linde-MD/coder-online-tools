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
        includeJ1939: j1939Nodes.length > 0,
        includeOthers: otherNodes.length > 0,
        j1939Mode: 'dedicated',
      });
    }
    return groups;
  }

  function executeDbcExport(j1939Nodes, otherNodes, options = {}) {
    const includeJ1939 = options.includeJ1939 !== false;
    const includeOthers = options.includeOthers !== false;
    const j1939Mode = options.j1939Mode === 'downgrade' ? 'downgrade' : 'dedicated';
    const silentStatus = options.silentStatus === true;
    const dateTag = options.dateTag || new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const filenameBase = options.filenameBase || `can-arch-nodes-${dateTag}`;
    const canExportJ1939 = includeJ1939 && j1939Nodes.length > 0;
    const canExportOthers = includeOthers && otherNodes.length > 0;
    if (!canExportJ1939 && !canExportOthers) {
      if (!silentStatus) {
        setStatus('请至少选择一种协议导出。', true);
      }
      return null;
    }
    let exportedFiles = 0;
    if (canExportJ1939 && j1939Mode === 'downgrade') {
      const downgradedJ1939Nodes = downgradeJ1939NodesToStandard(j1939Nodes);
      const mergedNodes = mergeStandardExportNodes(
        canExportOthers ? otherNodes : [],
        downgradedJ1939Nodes,
      );
      const dbc = serializeNodesToDbc(mergedNodes, { profile: 'standard' });
      downloadTextFile(`${filenameBase}.dbc`, dbc);
      exportedFiles = 1;
      const mergedNodeCount = new Set(mergedNodes.map((item) => item.id)).size;
      if (!silentStatus) {
        setStatus(`已导出 1 个普通 DBC 文件（J1939 已退化），覆盖 ${mergedNodeCount} 个 ECU。`);
      }
      return {
        exportedFiles,
        exportedNodeIds: [...new Set(mergedNodes.map((item) => item.id))],
      };
    }
    const hasBothDedicated = canExportJ1939 && canExportOthers;
    if (canExportJ1939) {
      const dbc = serializeNodesToDbc(j1939Nodes, { profile: 'j1939' });
      const filename = hasBothDedicated
        ? `${filenameBase}-j1939.dbc`
        : `${filenameBase}.dbc`;
      downloadTextFile(filename, dbc);
      exportedFiles += 1;
    }
    if (canExportOthers) {
      const dbc = serializeNodesToDbc(otherNodes, { profile: 'standard' });
      const filename = hasBothDedicated
        ? `${filenameBase}-other.dbc`
        : `${filenameBase}.dbc`;
      downloadTextFile(filename, dbc);
      exportedFiles += 1;
    }
    const exportedNodes = new Set([
      ...j1939Nodes.map((item) => item.id),
      ...otherNodes.map((item) => item.id),
    ]).size;
    if (!silentStatus) {
      setStatus(`已导出 ${exportedFiles} 个 DBC 文件，覆盖 ${exportedNodes} 个 ECU。`);
    }
    return {
      exportedFiles,
      exportedNodeIds: [...new Set([
        ...j1939Nodes.map((item) => item.id),
        ...otherNodes.map((item) => item.id),
      ])],
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

  function openDbcExportForProtocolSplit(j1939Nodes, otherNodes) {
    pendingDbcExport.value = {
      mode: 'protocol-split',
      busGroups: [],
      j1939Nodes,
      otherNodes,
    };
    importModalOpen.value = false;
    importStage.value = 'choose';
  }

  function closeDbcExportModal() {
    pendingDbcExport.value = {
      mode: 'idle',
      busGroups: [],
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
      const invalidGroup = selectedGroups.find((group) => !group.includeJ1939 && !group.includeOthers);
      if (invalidGroup) {
        setStatus(`CAN BUS ${invalidGroup.busName} 未选择导出协议，请先选择协议或取消该 BUS。`, true);
        return;
      }
      const dateTag = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      let exportedFiles = 0;
      const exportedNodeIds = new Set();
      for (const group of selectedGroups) {
        if (!group.includeJ1939 && !group.includeOthers) continue;
        const filenameBase = `can-arch-${sanitizeFilenamePart(group.busName)}-${dateTag}`;
        const result = executeDbcExport(group.j1939Nodes, group.otherNodes, {
          includeJ1939: group.includeJ1939,
          includeOthers: group.includeOthers,
          j1939Mode: group.j1939Mode,
          silentStatus: true,
          filenameBase,
          dateTag,
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
      pendingDbcExport.value.j1939Nodes,
      pendingDbcExport.value.otherNodes,
      {
        includeJ1939: dbcExportSelection.value.includeJ1939,
        includeOthers: dbcExportSelection.value.includeOthers,
        j1939Mode: dbcExportSelection.value.j1939Mode,
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
        openDbcExportForBusGroups(busGroups);
        return;
      }
    }
    const exportNodes = buildExportNodeProjections();
    if (exportNodes.length === 0) {
      setStatus('请先选中至少一个 ECU、CAN BUS 或连线再导出。', true);
      return;
    }
    const { j1939Nodes, otherNodes } = splitExportNodesByProtocol(exportNodes);
    if (j1939Nodes.length > 0 && otherNodes.length > 0) {
      openDbcExportForProtocolSplit(j1939Nodes, otherNodes);
      return;
    }
    executeDbcExport(j1939Nodes, otherNodes, {
      includeJ1939: true,
      includeOthers: true,
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