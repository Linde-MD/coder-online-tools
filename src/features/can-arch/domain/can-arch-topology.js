import { canProtocols } from '@/features/can-arch/services/can-arch-dbc.js';
import {
  BUS_COLOR_POOL,
  DEFAULT_BUS_BAUD,
  DEFAULT_NODE_BASE_COLOR,
} from './can-arch-constants.js';
import { normalizeNodeBaseColor } from './can-arch-colors.js';
import {
  normalizeIntegerList,
  normalizeLinkStyle,
  normalizeProtocolsList,
} from './can-arch-protocols.js';

export function nowIso() {
  return new Date().toISOString();
}

export function normalizeBusColor(value, fallback = BUS_COLOR_POOL[0]) {
  if (!value) return fallback;
  const trimmed = String(value).trim();
  return trimmed || fallback;
}

export function cloneMessageWorkspaceSnapshot(workspace) {
  if (!workspace || typeof workspace !== 'object') return {};
  const cloned = {};
  for (const busId of Object.keys(workspace)) {
    const store = workspace[busId];
    if (!store || typeof store !== 'object') continue;
    cloned[busId] = {
      rxMessages: Array.isArray(store.rxMessages)
        ? store.rxMessages.map((msg) => (typeof msg?.toJSON === 'function' ? msg.toJSON() : { ...msg }))
        : [],
      txMessages: Array.isArray(store.txMessages)
        ? store.txMessages.map((msg) => (typeof msg?.toJSON === 'function' ? msg.toJSON() : { ...msg }))
        : [],
    };
  }
  return cloned;
}

export function cloneNodesSnapshot(source) {
  return (Array.isArray(source) ? source : []).map((item) => ({
    ...item,
    position: {
      x: Number(item?.position?.x) || 0,
      y: Number(item?.position?.y) || 0,
    },
    protocols: Array.isArray(item?.protocols) ? [...item.protocols] : [],
    j1939Addresses: Array.isArray(item?.j1939Addresses) ? [...item.j1939Addresses] : [],
    canopenNodeIds: Array.isArray(item?.canopenNodeIds) ? [...item.canopenNodeIds] : [],
    baseColor: normalizeNodeBaseColor(item?.baseColor),
    messageWorkspace: cloneMessageWorkspaceSnapshot(item?.messageWorkspace),
  }));
}

export function cloneBusesSnapshot(source) {
  return (Array.isArray(source) ? source : []).map((item) => ({
    id: String(item?.id || crypto.randomUUID()),
    name: String(item?.name || 'CAN 1').trim() || 'CAN 1',
    baudRate: Number.isFinite(Number(item?.baudRate)) ? Number(item.baudRate) : DEFAULT_BUS_BAUD,
    color: normalizeBusColor(item?.color),
    position: {
      x: Number(item?.position?.x) || 0,
      y: Number(item?.position?.y) || 0,
    },
  }));
}

export function cloneLinksSnapshot(source) {
  return (Array.isArray(source) ? source : []).map((item) => ({
    id: String(item?.id || crypto.randomUUID()),
    fromType: item?.fromType === 'bus' ? 'bus' : 'node',
    fromId: String(item?.fromId || item?.nodeId || ''),
    toType: item?.toType === 'node' ? 'node' : 'bus',
    toId: String(item?.toId || item?.busId || ''),
    fromAnchorEdge: ['left', 'right', 'top', 'bottom'].includes(item?.fromAnchorEdge)
      ? item.fromAnchorEdge
      : (['left', 'right', 'top', 'bottom'].includes(item?.anchorEdge) ? item.anchorEdge : 'auto'),
    fromAnchorOffset: Number.isFinite(Number(item?.fromAnchorOffset))
      ? Number(item.fromAnchorOffset)
      : (Number.isFinite(Number(item?.anchorOffset)) ? Number(item.anchorOffset) : 0.5),
    toAnchorEdge: ['left', 'right', 'top', 'bottom'].includes(item?.toAnchorEdge) ? item.toAnchorEdge : 'auto',
    toAnchorOffset: Number.isFinite(Number(item?.toAnchorOffset)) ? Number(item.toAnchorOffset) : 0.5,
    style: normalizeLinkStyle(item?.style),
    protocols: normalizeProtocolsList(item?.protocols),
    j1939Addresses: normalizeIntegerList(item?.j1939Addresses),
    canopenNodeIds: normalizeIntegerList(item?.canopenNodeIds),
    anchors: Array.isArray(item?.anchors)
      ? item.anchors
        .map((anchor) => ({ x: Number(anchor?.x), y: Number(anchor?.y) }))
        .filter((anchor) => Number.isFinite(anchor.x) && Number.isFinite(anchor.y))
      : [],
  }));
}

export function buildTopologySnapshot({ nodes, buses, links }) {
  return {
    nodes: cloneNodesSnapshot(nodes),
    buses: cloneBusesSnapshot(buses),
    links: cloneLinksSnapshot(links),
  };
}

export function hydrateNodes(rawNodes, { nextNodePosition } = {}) {
  const list = Array.isArray(rawNodes) ? rawNodes : [];
  return list
    .map((item) => {
      const node = {
        id: String(item?.id || crypto.randomUUID()),
        name: String(item?.name || '').trim() || 'ECU',
        note: String(item?.note || ''),
        position: {
          x: Number.isFinite(Number(item?.position?.x))
            ? Number(item.position.x)
            : (nextNodePosition ? nextNodePosition().x : 20),
          y: Number.isFinite(Number(item?.position?.y))
            ? Number(item.position.y)
            : (nextNodePosition ? nextNodePosition().y : 20),
        },
        protocols: Array.isArray(item?.protocols)
          ? item.protocols.filter((token) => [
              canProtocols.GENERIC_STD,
              canProtocols.GENERIC_EXT,
              canProtocols.J1939,
              canProtocols.CANOPEN,
            ].includes(token))
          : [],
        j1939Addresses: Array.isArray(item?.j1939Addresses)
          ? item.j1939Addresses.map((num) => Number.parseInt(num, 10)).filter((num) => Number.isInteger(num))
          : [],
        canopenNodeIds: Array.isArray(item?.canopenNodeIds)
          ? item.canopenNodeIds.map((num) => Number.parseInt(num, 10)).filter((num) => Number.isInteger(num))
          : [],
        baseColor: normalizeNodeBaseColor(item?.baseColor),
        createdAt: String(item?.createdAt || nowIso()),
        updatedAt: String(item?.updatedAt || nowIso()),
        source: item?.source === 'dbc-import' ? 'dbc-import' : 'manual',
      };

      if (item?.messageWorkspace && typeof item.messageWorkspace === 'object') {
        const workspace = {};
        for (const busId of Object.keys(item.messageWorkspace)) {
          const store = item.messageWorkspace[busId];
          if (!store || typeof store !== 'object') continue;
          workspace[busId] = {
            rxMessages: Array.isArray(store.rxMessages) ? store.rxMessages.map((msg) => ({ ...msg })) : [],
            txMessages: Array.isArray(store.txMessages) ? store.txMessages.map((msg) => ({ ...msg })) : [],
          };
        }
        node.messageWorkspace = workspace;
      }

      return node;
    })
    .filter((item) => Boolean(item.id));
}

export function hydrateBuses(rawBuses, { nextBusPosition } = {}) {
  const list = Array.isArray(rawBuses) ? rawBuses : [];
  return list
    .map((item, idx) => ({
      id: String(item?.id || crypto.randomUUID()),
      name: String(item?.name || `CAN ${idx + 1}`).trim() || `CAN ${idx + 1}`,
      baudRate: Number.isFinite(Number(item?.baudRate))
        ? Math.max(10, Math.round(Number(item.baudRate)))
        : DEFAULT_BUS_BAUD,
      color: normalizeBusColor(item?.color, BUS_COLOR_POOL[idx % BUS_COLOR_POOL.length]),
      position: {
        x: Number.isFinite(Number(item?.position?.x))
          ? Number(item.position.x)
          : (nextBusPosition ? nextBusPosition().x : 0),
        y: Number.isFinite(Number(item?.position?.y))
          ? Number(item.position.y)
          : (nextBusPosition ? nextBusPosition().y : 0),
      },
    }))
    .filter((item) => Boolean(item.id));
}

export function hydrateLinks(rawLinks, sourceNodes, sourceBuses) {
  const nodeIdSet = new Set((sourceNodes || []).map((item) => item.id));
  const busIdSet = new Set((sourceBuses || []).map((item) => item.id));
  const seen = new Set();
  return (Array.isArray(rawLinks) ? rawLinks : [])
    .map((item) => {
      const fromType = item?.fromType === 'bus' ? 'bus' : 'node';
      const toType = item?.toType === 'node' ? 'node' : 'bus';
      const fromId = String(item?.fromId || item?.nodeId || '');
      const toId = String(item?.toId || item?.busId || '');
      if (fromType === 'node' && !nodeIdSet.has(fromId)) return null;
      if (toType === 'node' && !nodeIdSet.has(toId)) return null;
      if (fromType === 'bus' && !busIdSet.has(fromId)) return null;
      if (toType === 'bus' && !busIdSet.has(toId)) return null;
      const key = `${fromType}:${fromId}__${toType}:${toId}`;
      if (seen.has(key)) return null;
      seen.add(key);

      return {
        id: String(item?.id || crypto.randomUUID()),
        fromType,
        fromId,
        toType,
        toId,
        fromAnchorEdge: ['left', 'right', 'top', 'bottom'].includes(item?.fromAnchorEdge)
          ? item.fromAnchorEdge
          : (['left', 'right', 'top', 'bottom'].includes(item?.anchorEdge) ? item.anchorEdge : 'auto'),
        fromAnchorOffset: Number.isFinite(Number(item?.fromAnchorOffset))
          ? Number(item.fromAnchorOffset)
          : (Number.isFinite(Number(item?.anchorOffset)) ? Number(item.anchorOffset) : 0.5),
        toAnchorEdge: ['left', 'right', 'top', 'bottom'].includes(item?.toAnchorEdge) ? item.toAnchorEdge : 'auto',
        toAnchorOffset: Number.isFinite(Number(item?.toAnchorOffset)) ? Number(item.toAnchorOffset) : 0.5,
        style: normalizeLinkStyle(item?.style),
        protocols: normalizeProtocolsList(item?.protocols),
        j1939Addresses: normalizeIntegerList(item?.j1939Addresses),
        canopenNodeIds: normalizeIntegerList(item?.canopenNodeIds),
        anchors: Array.isArray(item?.anchors)
          ? item.anchors
            .map((anchor) => ({ x: Number(anchor?.x), y: Number(anchor?.y) }))
            .filter((anchor) => Number.isFinite(anchor.x) && Number.isFinite(anchor.y))
          : [],
      };
    })
    .filter((item) => item !== null);
}

export function extractTopologyFromConfigPayload(payload) {
  if (Array.isArray(payload)) {
    return { nodes: payload, buses: [], links: [] };
  }
  if (payload && typeof payload === 'object' && Array.isArray(payload.nodes)) {
    return {
      nodes: payload.nodes,
      buses: Array.isArray(payload.buses) ? payload.buses : [],
      links: Array.isArray(payload.links) ? payload.links : [],
    };
  }
  throw new Error('配置文件格式不正确，缺少 nodes 列表。');
}