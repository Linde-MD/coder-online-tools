import { canProtocols } from '@/features/can-arch/services/can-arch-dbc.js';
import {
  normalizeIntegerList as domainNormalizeIntegerList,
  normalizeLinkStyle as domainNormalizeLinkStyle,
  normalizeProtocolsList as domainNormalizeProtocolsList,
} from './can-arch-normalizers.js';
import { LINK_STYLE_OPTIONS } from './can-arch-constants.js';

export function normalizeProtocolsList(value) {
  return domainNormalizeProtocolsList(value, Object.values(canProtocols));
}

export function normalizeLinkStyle(styleInput) {
  return domainNormalizeLinkStyle(styleInput, LINK_STYLE_OPTIONS);
}

export function normalizeIntegerList(value) {
  return domainNormalizeIntegerList(value);
}

export function protocolLabel(protocol) {
  if (protocol === canProtocols.GENERIC_STD) return 'Generic(Std)';
  if (protocol === canProtocols.GENERIC_EXT) return 'Generic(Ext)';
  return protocol === canProtocols.CANOPEN ? 'CANopen' : protocol;
}

export function protocolBadgeClass(protocol) {
  if (protocol === canProtocols.GENERIC_STD || protocol === canProtocols.GENERIC_EXT) return 'can-pill-neutral';
  return protocol === canProtocols.CANOPEN ? 'can-pill-canopen' : 'can-pill-j1939';
}

export function protocolRowClass(protocol) {
  if (protocol === canProtocols.GENERIC_STD || protocol === canProtocols.GENERIC_EXT) return 'generic';
  if (protocol === canProtocols.CANOPEN) return 'canopen';
  if (protocol === canProtocols.J1939) return 'j1939';
  return 'generic';
}

export function nodeProtocolGroups(node) {
  const groups = [];
  const hasGenericStd = node.protocols.includes(canProtocols.GENERIC_STD);
  const hasGenericExt = node.protocols.includes(canProtocols.GENERIC_EXT);
  const hasJ1939 = node.protocols.includes(canProtocols.J1939) || node.j1939Addresses.length > 0;
  const hasCanopen = node.protocols.includes(canProtocols.CANOPEN) || node.canopenNodeIds.length > 0;

  if (hasGenericStd) {
    groups.push({
      key: 'generic-std',
      label: 'Generic(Std)',
      addressText: '',
      showAddress: false,
      badgeClass: 'can-pill-neutral',
      rowClass: 'generic',
    });
  }

  if (hasGenericExt) {
    groups.push({
      key: 'generic-ext',
      label: 'Generic(Ext)',
      addressText: '',
      showAddress: false,
      badgeClass: 'can-pill-neutral',
      rowClass: 'generic',
    });
  }

  if (hasJ1939) {
    const addrList = node.j1939Addresses.map((id) => `${id}`).join(', ') || '地址缺失';
    groups.push({
      key: 'j1939',
      label: 'J1939',
      addressText: addrList,
      showAddress: true,
      badgeClass: 'can-pill-j1939',
      rowClass: 'j1939',
    });
  }

  if (hasCanopen) {
    const idList = node.canopenNodeIds.map((id) => `${id}`).join(', ') || 'Node-Id缺失';
    groups.push({
      key: 'canopen',
      label: 'CANopen',
      addressText: idList,
      showAddress: true,
      badgeClass: 'can-pill-canopen',
      rowClass: 'canopen',
    });
  }

  return groups;
}

export function resolveNodeDefaultProtocols(node) {
  const normalized = normalizeProtocolsList(node?.protocols);
  if (normalized.length > 0) return normalized;
  return [canProtocols.GENERIC_STD];
}

export function resolveNodeDefaultJ1939Addresses(node) {
  return normalizeIntegerList(node?.j1939Addresses);
}

export function resolveNodeDefaultCanopenNodeIds(node) {
  return normalizeIntegerList(node?.canopenNodeIds);
}

export function resolveLinkConnectedNodeId(link) {
  const fromType = link?.fromType || 'node';
  const toType = link?.toType || 'bus';
  const fromId = link?.fromId || link?.nodeId;
  const toId = link?.toId || link?.busId;
  return fromType === 'node' ? fromId : (toType === 'node' ? toId : '');
}

export function resolveLinkAllowedProtocols(link, findNode) {
  const nodeId = resolveLinkConnectedNodeId(link);
  if (!nodeId) return [canProtocols.GENERIC_STD];
  const node = findNode(nodeId);
  return resolveNodeDefaultProtocols(node);
}

export function resolveLinkAllowedJ1939Addresses(link, findNode) {
  const nodeId = resolveLinkConnectedNodeId(link);
  if (!nodeId) return [];
  const node = findNode(nodeId);
  return resolveNodeDefaultJ1939Addresses(node);
}

export function resolveLinkAllowedCanopenNodeIds(link, findNode) {
  const nodeId = resolveLinkConnectedNodeId(link);
  if (!nodeId) return [];
  const node = findNode(nodeId);
  return resolveNodeDefaultCanopenNodeIds(node);
}

export function normalizeLinkProtocolsByNode(link, protocolsInput, findNode) {
  const allowed = new Set(resolveLinkAllowedProtocols(link, findNode));
  return normalizeProtocolsList(protocolsInput).filter((token) => allowed.has(token));
}

export function normalizeLinkJ1939AddressesByNode(link, protocolsInput, addressesInput, findNode) {
  const protocols = normalizeLinkProtocolsByNode(link, protocolsInput, findNode);
  if (!protocols.includes(canProtocols.J1939)) return [];
  const allowed = new Set(resolveLinkAllowedJ1939Addresses(link, findNode));
  return normalizeIntegerList(addressesInput).filter((num) => allowed.has(num));
}

export function normalizeLinkCanopenNodeIdsByNode(link, protocolsInput, addressesInput, findNode) {
  const protocols = normalizeLinkProtocolsByNode(link, protocolsInput, findNode);
  if (!protocols.includes(canProtocols.CANOPEN)) return [];
  const allowed = new Set(resolveLinkAllowedCanopenNodeIds(link, findNode));
  return normalizeIntegerList(addressesInput).filter((num) => allowed.has(num));
}

export function pruneNodeConnectedLinkCapabilities(
  nodeId,
  allowedProtocols,
  allowedJ1939Addresses,
  allowedCanopenNodeIds,
  links,
) {
  const allowedSet = new Set(normalizeProtocolsList(allowedProtocols));
  const allowedJ1939Set = new Set(normalizeIntegerList(allowedJ1939Addresses));
  const allowedCanopenSet = new Set(normalizeIntegerList(allowedCanopenNodeIds));
  let changed = false;
  for (const link of links) {
    const fromType = link.fromType || 'node';
    const toType = link.toType || 'bus';
    const fromId = link.fromId || link.nodeId;
    const toId = link.toId || link.busId;
    const isConnectedNode = (fromType === 'node' && fromId === nodeId) || (toType === 'node' && toId === nodeId);
    if (!isConnectedNode) continue;

    const normalized = normalizeProtocolsList(link.protocols);
    const pruned = normalized.filter((token) => allowedSet.has(token));
    const normalizedJ1939 = normalizeIntegerList(link.j1939Addresses);
    const prunedJ1939 = pruned.includes(canProtocols.J1939)
      ? normalizedJ1939.filter((num) => allowedJ1939Set.has(num))
      : [];
    const normalizedCanopen = normalizeIntegerList(link.canopenNodeIds);
    const prunedCanopen = pruned.includes(canProtocols.CANOPEN)
      ? normalizedCanopen.filter((num) => allowedCanopenSet.has(num))
      : [];
    const protocolChanged = JSON.stringify(normalized) !== JSON.stringify(pruned);
    const j1939Changed = JSON.stringify(normalizedJ1939) !== JSON.stringify(prunedJ1939);
    const canopenChanged = JSON.stringify(normalizedCanopen) !== JSON.stringify(prunedCanopen);
    if (!protocolChanged && !j1939Changed && !canopenChanged) continue;
    link.protocols = pruned;
    link.j1939Addresses = prunedJ1939;
    link.canopenNodeIds = prunedCanopen;
    changed = true;
  }
  return changed;
}