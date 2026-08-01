import { canProtocols, serializeNodesToDbc } from '@/features/can-arch/services/can-arch-dbc.js';
import { normalizeIntegerList, normalizeProtocolsList } from '@/features/can-arch/domain/can-arch-protocols.js';
import { downloadBlobFile, downloadTextFile } from '@/features/can-arch/services/can-arch-export.js';

export function splitExportNodesByProtocol(nodesForExport) {
  const j1939Nodes = [];
  const otherNodes = [];

  for (const node of nodesForExport) {
    const protocols = normalizeProtocolsList(node.protocols);
    const hasJ1939 = protocols.includes(canProtocols.J1939);
    const otherProtocols = protocols.filter((token) => token !== canProtocols.J1939);

    if (hasJ1939) {
      j1939Nodes.push({
        ...node,
        protocols: [canProtocols.J1939],
        j1939Addresses: normalizeIntegerList(node.j1939Addresses),
        canopenNodeIds: [],
      });
    }

    if (otherProtocols.length > 0 || !hasJ1939) {
      const protocolsForOthers = otherProtocols.length > 0 ? otherProtocols : [canProtocols.GENERIC_STD];
      otherNodes.push({
        ...node,
        protocols: protocolsForOthers,
        j1939Addresses: [],
        canopenNodeIds: protocolsForOthers.includes(canProtocols.CANOPEN)
          ? normalizeIntegerList(node.canopenNodeIds)
          : [],
      });
    }
  }

  return { j1939Nodes, otherNodes };
}

export function downgradeJ1939NodesToStandard(nodesInput) {
  const list = Array.isArray(nodesInput) ? nodesInput : [];
  return list.map((node) => ({
    ...node,
    protocols: [canProtocols.GENERIC_EXT],
    j1939Addresses: [],
    canopenNodeIds: [],
  }));
}

export function mergeStandardExportNodes(baseNodes, addonNodes) {
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

export function executeDbcExport({
  j1939Nodes,
  otherNodes,
  includeJ1939 = true,
  includeOthers = true,
  j1939Mode = 'dedicated',
  silentStatus = false,
  filenameBase,
  status,
}) {
  const canExportJ1939 = includeJ1939 && j1939Nodes.length > 0;
  const canExportOthers = includeOthers && otherNodes.length > 0;
  if (!canExportJ1939 && !canExportOthers) {
    if (!silentStatus && status) {
      status('请至少选择一种协议导出。', true);
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
    if (!silentStatus && status) {
      status(`已导出 1 个普通 DBC 文件（J1939 已退化），覆盖 ${mergedNodeCount} 个 ECU。`);
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
  if (!silentStatus && status) {
    status(`已导出 ${exportedFiles} 个 DBC 文件，覆盖 ${exportedNodes} 个 ECU。`);
  }
  return {
    exportedFiles,
    exportedNodeIds: [...new Set([
      ...j1939Nodes.map((item) => item.id),
      ...otherNodes.map((item) => item.id),
    ])],
  };
}

export function buildDbcBusGroups({
  allNodes,
  allBuses,
  allLinks,
  selectedIds,
  selectedBusIds,
  selectedLinkId,
  resolveLinkNodeId,
  resolveLinkBusId,
  buildProjectionFromNode,
  buildProjectionFromLink,
  finalizeProjectionMap,
  sanitizeFilenamePart,
}) {
  const busSet = new Set();
  const ordered = [];
  const pushBusId = (busId) => {
    if (!busId || busSet.has(busId)) return;
    if (!allBuses.find((item) => item.id === busId)) return;
    busSet.add(busId);
    ordered.push(busId);
  };

  for (const busId of selectedBusIds) {
    pushBusId(busId);
  }

  if (selectedLinkId) {
    const link = allLinks.find((item) => item.id === selectedLinkId);
    pushBusId(resolveLinkBusId(link));
  }

  if (selectedIds.length > 0) {
    const selectedNodeSet = new Set(selectedIds);
    for (const link of allLinks) {
      const nodeId = resolveLinkNodeId(link);
      if (!selectedNodeSet.has(nodeId)) continue;
      pushBusId(resolveLinkBusId(link));
    }
  }

  const selectedNodeSet = new Set(selectedIds);
  const selectedBusSet = new Set(selectedBusIds);
  const selectedLink = selectedLinkId
    ? allLinks.find((item) => item.id === selectedLinkId)
    : null;

  const groups = [];
  for (const busId of ordered) {
    const bus = allBuses.find((item) => item.id === busId);
    if (!bus) continue;

    const projections = new Map();
    for (const link of allLinks) {
      const linkBusId = resolveLinkBusId(link);
      if (linkBusId !== busId) continue;
      const linkNodeId = resolveLinkNodeId(link);
      const fromSelectedBus = selectedBusSet.has(busId);
      const fromSelectedNode = selectedNodeSet.has(linkNodeId);
      const fromSelectedLink = Boolean(selectedLink && selectedLink.id === link.id);
      if (!fromSelectedBus && !fromSelectedNode && !fromSelectedLink) continue;
      buildProjectionFromLink(projections, link);
    }

    for (const node of allNodes) {
      if (!selectedNodeSet.has(node.id)) continue;
      const touchesBus = allLinks.some((link) =>
        resolveLinkNodeId(link) === node.id && resolveLinkBusId(link) === busId);
      if (!touchesBus) continue;
      if (!projections.has(node.id)) {
        buildProjectionFromNode(projections, node);
      }
    }

    const exportNodes = finalizeProjectionMap(projections);
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

export function buildNodeProjections({
  allNodes,
  allLinks,
  selectedIds,
  selectedLinkId,
  selectedBusIds,
  resolveLinkNodeId,
  resolveLinkBusId,
  buildProjectionFromNode,
  buildProjectionFromLink,
  finalizeProjectionMap,
}) {
  const projections = new Map();
  const selectedNodeSet = new Set(selectedIds);
  for (const node of allNodes) {
    if (!selectedNodeSet.has(node.id)) continue;
    buildProjectionFromNode(projections, node);
  }

  if (selectedLinkId) {
    const link = allLinks.find((item) => item.id === selectedLinkId);
    if (link) buildProjectionFromLink(projections, link);
  }

  if (selectedBusIds.length > 0) {
    const busSet = new Set(selectedBusIds);
    for (const link of allLinks) {
      if (!busSet.has(resolveLinkBusId(link))) continue;
      buildProjectionFromLink(projections, link);
    }
  }

  return finalizeProjectionMap(projections);
}