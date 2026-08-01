import { computed, reactive, ref } from 'vue';
import {
  normalizeProtocolsList,
  normalizeIntegerList,
} from '@/features/can-arch/domain/can-arch-protocols.js';
import {
  createNodeName,
  createBusName,
  ensureUniqueLabel,
} from '@/features/can-arch/domain/can-arch-naming.js';

export function useClipboard({
  getNodes,
  getBuses,
  getLinks,
  selectedIds,
  selectedBusIds,
  setStatus,
  clearSelection,
  clearBusSelection,
  syncDraftFromSelected,
  syncBusDraftFromSelected,
  pushHistorySnapshot,
}) {
  const clipboardPayload = ref(null);
  const pasteSerial = ref(0);

  function copyCurrentSelection() {
    const nodes = getNodes();
    const buses = getBuses();
    const links = getLinks();
    const idSet = new Set(selectedIds.value);
    const busIdSet = new Set(selectedBusIds.value);

    const capturedNodes = nodes.filter((item) => idSet.has(item.id));
    const capturedBuses = buses.filter((item) => busIdSet.has(item.id));
    const nodeIds = new Set(capturedNodes.map((item) => item.id));
    const busIds = new Set(capturedBuses.map((item) => item.id));

    const capturedLinks = links.filter((link) => {
      const fromNode = resolveLinkNodeId(link);
      const toBus = resolveLinkBusId(link);
      return (fromNode && nodeIds.has(fromNode)) || (toBus && busIds.has(toBus));
    });

    if (capturedNodes.length === 0 && capturedBuses.length === 0 && capturedLinks.length === 0) {
      setStatus('请先选择至少一个 ECU、CAN BUS 或连线。', true);
      return;
    }

    clipboardPayload.value = {
      nodes: capturedNodes.map((node) => ({
        id: node.id,
        name: node.name,
        note: node.note || '',
        x: node.x,
        y: node.y,
        width: node.width,
        height: node.height,
        protocols: [...(node.protocols || [])],
        j1939Addresses: [...(node.j1939Addresses || [])],
        canopenNodeIds: [...(node.canopenNodeIds || [])],
        baseColor: node.baseColor || '',
        created: node.created || '',
        touched: false,
      })),
      buses: capturedBuses.map((bus) => ({
        id: bus.id,
        name: bus.name,
        baudRate: bus.baudRate,
        color: bus.color || '',
        x: bus.x,
        y: bus.y,
        width: bus.width,
        height: bus.height,
      })),
      links: capturedLinks.map((link) => ({
        id: link.id,
        fromType: link.fromType,
        fromId: link.fromId,
        toType: link.toType,
        toId: link.toId,
        fromAnchorEdge: link.fromAnchorEdge,
        fromAnchorOffset: link.fromAnchorOffset,
        toAnchorEdge: link.toAnchorEdge,
        toAnchorOffset: link.toAnchorOffset,
        style: link.style,
        protocols: [...(link.protocols || [])],
        j1939Addresses: [...(link.j1939Addresses || [])],
        canopenNodeIds: [...(link.canopenNodeIds || [])],
        anchors: [...(link.anchors || [])],
      })),
    };
    setStatus(`已复制 ${capturedNodes.length} 个 ECU、${capturedBuses.length} 个 BUS、${capturedLinks.length} 条连线。`);
  }

  function resolveLinkNodeId(link) {
    if (!link) return '';
    return link.fromType === 'node' ? link.fromId : '';
  }

  function resolveLinkBusId(link) {
    if (!link) return '';
    if (link.fromType === 'bus') return link.fromId;
    if (link.toType === 'bus') return link.toId;
    return '';
  }

  function pasteClipboard(point = null) {
    const payload = clipboardPayload.value;
    if (!payload) {
      setStatus('剪贴板为空。', true);
      return;
    }

    const nodes = getNodes();
    const buses = getBuses();
    const links = getLinks();
    const usedNodeNames = new Set(nodes.map((node) => node.name));
    const usedBusNames = new Set(buses.map((bus) => bus.name));

    const idMapping = new Map();
    const busIdMapping = new Map();

    pasteSerial.value += 1;
    const serial = pasteSerial.value;
    const timeSuffix = `_paste_${serial}`;
    const nowIso = () => new Date().toISOString();

    const pastedNodes = (payload.nodes || []).map((node) => {
      const newId = crypto.randomUUID();
      idMapping.set(node.id, newId);
      const newName = ensureUniqueLabel(`${node.name}${timeSuffix}`, usedNodeNames);
      return {
        ...node,
        id: newId,
        name: newName,
        x: node.x + 36,
        y: node.y + 36,
        protocols: [...(node.protocols || [])],
        j1939Addresses: [...(node.j1939Addresses || [])],
        canopenNodeIds: [...(node.canopenNodeIds || [])],
        created: nowIso(),
        touched: false,
      };
    });

    const pastedBuses = (payload.buses || []).map((bus) => {
      const newId = crypto.randomUUID();
      busIdMapping.set(bus.id, newId);
      const newName = ensureUniqueLabel(`${bus.name}${timeSuffix}`, usedBusNames);
      return {
        ...bus,
        id: newId,
        name: newName,
        x: bus.x + 36,
        y: bus.y + 36,
      };
    });

    const pastedLinks = (payload.links || []).map((link) => {
      let newFromId = link.fromId;
      if (link.fromType === 'node' && idMapping.has(link.fromId)) {
        newFromId = idMapping.get(link.fromId);
      } else if (link.fromType === 'bus' && busIdMapping.has(link.fromId)) {
        newFromId = busIdMapping.get(link.fromId);
      }
      let newToId = link.toId;
      if (link.toType === 'node' && idMapping.has(link.toId)) {
        newToId = idMapping.get(link.toId);
      } else if (link.toType === 'bus' && busIdMapping.has(link.toId)) {
        newToId = busIdMapping.get(link.toId);
      }
      return {
        ...link,
        id: crypto.randomUUID(),
        fromId: newFromId,
        toId: newToId,
        fromAnchorOffset: link.fromAnchorOffset,
        toAnchorOffset: link.toAnchorOffset,
        anchors: (link.anchors || []).map((anchor) => ({
          id: crypto.randomUUID(),
          x: anchor.x + 36,
          y: anchor.y + 36,
        })),
      };
    });

    let newSelectedIds = pastedNodes.map((node) => node.id);
    let newSelectedBusIds = pastedBuses.map((bus) => bus.id);

    if (point && pastedNodes.length === 1) {
      pastedNodes[0].x = point.x - pastedNodes[0].width / 2;
      pastedNodes[0].y = point.y - pastedNodes[0].height / 2;
    } else if (point && pastedNodes.length > 1) {
      const minX = Math.min(...pastedNodes.map((n) => n.x));
      const minY = Math.min(...pastedNodes.map((n) => n.y));
      const offsetX = point.x - (minX + 36);
      const offsetY = point.y - (minY + 36);
      for (const node of pastedNodes) {
        node.x += offsetX;
        node.y += offsetY;
      }
    }

    pushHistorySnapshot();
    nodes.push(...pastedNodes);
    buses.push(...pastedBuses);
    links.push(...pastedLinks);
    clearSelection && clearSelection();
    clearBusSelection && clearBusSelection();
    selectedIds.value = newSelectedIds;
    selectedBusIds.value = newSelectedBusIds;
    syncDraftFromSelected && syncDraftFromSelected();
    syncBusDraftFromSelected && syncBusDraftFromSelected();

    setStatus(`已粘贴 ${pastedNodes.length} 个 ECU、${pastedBuses.length} 个 BUS、${pastedLinks.length} 条连线。`);
  }

  return {
    clipboardPayload,
    pasteSerial,
    copyCurrentSelection,
    pasteClipboard,
  };
}