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
  nodes,
  j1939Mode = 'dedicated',
  silentStatus = false,
  filenameBase,
  status,
}) {
  const safeNodes = Array.isArray(nodes) ? nodes : [];

  if (safeNodes.length === 0) {
    if (!silentStatus && status) {
      status('没有可导出的 ECU。', true);
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

  const dbc = serializeNodesToDbc(exportNodes, { profile: 'standard' });
  downloadTextFile(`${filenameBase}.dbc`, dbc);

  const uniqueNodeIds = new Set(exportNodes.map((item) => item.id));
  if (!silentStatus && status) {
    const modeDesc = j1939Mode === 'downgrade' ? '（J1939 已降级为标准扩展帧）' : '';
    status(`已导出 1 个 DBC 文件${modeDesc}，覆盖 ${uniqueNodeIds.size} 个 ECU。`);
  }

  return {
    exportedFiles: 1,
    exportedNodeIds: [...uniqueNodeIds],
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