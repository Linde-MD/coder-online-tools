import { ref } from 'vue';
import {
  buildLinkGeometryPath as geometryBuildLinkGeometryPath,
  buildOrthogonalPoints as geometryBuildOrthogonalPoints,
  buildPolylinePath as geometryBuildPolylinePath,
  buildRoundedOrthogonalPath as geometryBuildRoundedOrthogonalPath,
  distancePointToSegment as geometryDistancePointToSegment,
  resolveNodeAnchorByEdge as geometryResolveNodeAnchorByEdge,
  resolveNodeAnchorFromDirection as geometryResolveNodeAnchorFromDirection,
  resolveBusAnchorFromDirection as geometryResolveBusAnchorFromDirection,
  resolveModuleAnchorPoint as geometryResolveModuleAnchorPoint,
  resolveNodeEdgeAnchorFromPointer as geometryResolveNodeEdgeAnchorFromPointer,
} from '@/features/can-arch/domain/can-arch-geometry.js';
import {
  addAnchorToLink as domainAddAnchorToLink,
  ensureControlAnchorsForLink as domainEnsureControlAnchorsForLink,
  findBusByPoint as domainFindBusByPoint,
  findNodeByPoint as domainFindNodeByPoint,
  nodeLinkDots as domainNodeLinkDots,
  resolveLinkEndpointsForGeometry as domainResolveLinkEndpointsForGeometry,
} from '@/features/can-arch/domain/can-arch-link-geometry.js';
import { normalizeLinkStyle as domainNormalizeLinkStyle } from '@/features/can-arch/domain/can-arch-normalizers.js';
import {
  BUS_RADIUS,
  LINK_STYLE_OPTIONS,
  NODE_EDGE_LINK_HIT_THRESHOLD,
  NODE_HEIGHT,
  NODE_WIDTH,
} from '@/features/can-arch/domain/can-arch-constants.js';

export function useLinkCreation({
  nodes,
  buses,
  links,
  activeLinkStyle,
  linkHoverNodeEdge,
  linkHoverBusId,
  linkDraftTarget,
  selectedLinkId,
  selectedIds,
  selectedBusIds,
  setStatus,
  pushHistorySnapshot,
  resolvePointerInCanvas,
  onCreated,
}) {
  const linkDraftState = ref(null);
  const linkDraftVersion = ref(0);

  function bumpLinkDraftVersion() {
    linkDraftVersion.value += 1;
  }

  function normalizeLinkStyle(styleInput) {
    return domainNormalizeLinkStyle(styleInput, LINK_STYLE_OPTIONS);
  }

  function resolveNodeAnchorByEdge(node, edge, offsetRatio) {
    return geometryResolveNodeAnchorByEdge(node, edge, offsetRatio, NODE_WIDTH, NODE_HEIGHT);
  }

  function resolveModuleByRef(type, id) {
    if (type === 'node') {
      return nodes.value.find((item) => item.id === id) || null;
    }
    if (type === 'bus') {
      return buses.value.find((item) => item.id === id) || null;
    }
    return null;
  }

  function resolveNodeAnchorFromDirection(node, targetPoint) {
    return geometryResolveNodeAnchorFromDirection(node, targetPoint, NODE_WIDTH, NODE_HEIGHT);
  }

  function resolveBusAnchorFromDirection(bus, targetPoint) {
    return geometryResolveBusAnchorFromDirection(bus, targetPoint, BUS_RADIUS);
  }

  function resolveModuleAnchorPoint(type, module, anchorEdge, anchorOffset, targetPoint) {
    return geometryResolveModuleAnchorPoint(
      type,
      module,
      anchorEdge,
      anchorOffset,
      targetPoint,
      NODE_WIDTH,
      NODE_HEIGHT,
      BUS_RADIUS,
    );
  }

  function resolveLinkEndpointsForGeometry(link) {
    return domainResolveLinkEndpointsForGeometry(link, resolveModuleByRef);
  }

  function ensureControlAnchorsForLink(link) {
    domainEnsureControlAnchorsForLink(link, resolveModuleByRef, normalizeLinkStyle);
  }

  function buildOrthogonalPoints(start, end) {
    return geometryBuildOrthogonalPoints(start, end);
  }

  function buildPolylinePath(points) {
    return geometryBuildPolylinePath(points);
  }

  function buildRoundedOrthogonalPath(points, radius = 14) {
    return geometryBuildRoundedOrthogonalPath(points, radius);
  }

  function buildLinkGeometryPath(style, start, end, anchors) {
    return geometryBuildLinkGeometryPath(style, start, end, anchors, normalizeLinkStyle);
  }

  function nodeLinkDots(node) {
    return domainNodeLinkDots(node, links.value, resolveModuleByRef);
  }

  function distancePointToSegment(point, a, b) {
    return geometryDistancePointToSegment(point, a, b);
  }

  function findNodeByPoint(point, excludeNodeId = '') {
    return domainFindNodeByPoint(point, nodes.value, excludeNodeId);
  }

  function findBusByPoint(point, excludeBusId = '') {
    return domainFindBusByPoint(point, buses.value, excludeBusId);
  }

  function resolveNodeEdgeAnchorFromPointer(node, pointer) {
    return geometryResolveNodeEdgeAnchorFromPointer(
      node,
      pointer,
      NODE_WIDTH,
      NODE_HEIGHT,
      NODE_EDGE_LINK_HIT_THRESHOLD,
    );
  }

  function resolveDropTargetFromEvent(event, fromRef) {
    const point = resolvePointerInCanvas(event);
    if (!point) return null;
    const excludeNodeId = fromRef?.type === 'node' ? fromRef.id : '';
    const excludeBusId = fromRef?.type === 'bus' ? fromRef.id : '';
    const foundNode = findNodeByPoint(point, excludeNodeId);
    if (foundNode) {
      return { type: 'node', id: foundNode.id, point };
    }
    const foundBus = findBusByPoint(point, excludeBusId);
    if (foundBus) {
      return { type: 'bus', id: foundBus.id, point };
    }
    return null;
  }

  function onNodeLinkPointerDown(node, event, edgeAnchor = null) {
    if (event.button !== 0) return;
    const startAnchor = edgeAnchor || {
      edge: 'right',
      offset: 0.5,
      point: resolveNodeAnchorByEdge(node, 'right', 0.5),
    };
    linkDraftState.value = {
      fromType: 'node',
      fromId: node.id,
      pointerId: event.pointerId,
      fromAnchorEdge: startAnchor.edge,
      fromAnchorOffset: startAnchor.offset,
      start: { ...startAnchor.point },
      current: { ...startAnchor.point },
      pointerTarget: event.currentTarget,
    };
    bumpLinkDraftVersion();
    event.currentTarget?.setPointerCapture?.(event.pointerId);
    window.addEventListener('pointermove', onNodeLinkPointerMove);
    window.addEventListener('pointerup', onNodeLinkPointerUp);
    document.addEventListener('pointermove', onNodeLinkPointerMove);
    document.addEventListener('pointerup', onNodeLinkPointerUp);
  }

  function onNodeLinkPointerMove(event) {
    if (!linkDraftState.value || linkDraftState.value.pointerId !== event.pointerId) return;
    const point = resolvePointerInCanvas(event);
    if (!point) return;
    const fromRef = { type: linkDraftState.value.fromType, id: linkDraftState.value.fromId };
    const target = resolveDropTargetFromEvent(event, fromRef);
    linkDraftTarget.value = target;
    linkDraftState.value.current = { x: point.x, y: point.y };
    bumpLinkDraftVersion();
  }

  function clearNodeLinkDraft() {
    if (!linkDraftState.value) return;
    linkDraftState.value.pointerTarget?.releasePointerCapture?.(linkDraftState.value.pointerId);
    linkDraftState.value = null;
    bumpLinkDraftVersion();
    linkDraftTarget.value = null;
    linkHoverNodeEdge.nodeId = '';
    linkHoverNodeEdge.edge = '';
    linkHoverBusId.value = '';
    window.removeEventListener('pointermove', onNodeLinkPointerMove);
    window.removeEventListener('pointerup', onNodeLinkPointerUp);
    document.removeEventListener('pointermove', onNodeLinkPointerMove);
    document.removeEventListener('pointerup', onNodeLinkPointerUp);
  }

  function onNodeLinkPointerUp(event) {
    if (!linkDraftState.value || linkDraftState.value.pointerId !== event.pointerId) return;
    const fromRef = { type: linkDraftState.value.fromType, id: linkDraftState.value.fromId };
    const toRef = resolveDropTargetFromEvent(event, fromRef);
    const fromAnchorEdge = linkDraftState.value.fromAnchorEdge || 'auto';
    const fromAnchorOffset = Number.isFinite(Number(linkDraftState.value.fromAnchorOffset))
      ? Number(linkDraftState.value.fromAnchorOffset)
      : 0.5;
    clearNodeLinkDraft();
    if (!toRef) {
      setStatus('未命中目标 CAN BUS / ECU，请拖到目标模块上再松手。', true);
      return;
    }
    pushHistorySnapshot();
    const created = onCreated?.(fromRef, toRef, {
      fromAnchor: {
        edge: fromAnchorEdge,
        offset: fromAnchorOffset,
      },
      style: activeLinkStyle.value,
    });
    if (created) {
      setStatus('已创建连线。');
    }
  }

  function addAnchorToLink(linkId, point) {
    const link = links.value.find((item) => item.id === linkId);
    if (!link) return false;
    return domainAddAnchorToLink(link, point, resolveLinkEndpointsForGeometry, normalizeLinkStyle);
  }

  return {
    linkDraftState,
    linkDraftVersion,
    linkDraftTarget,
    bumpLinkDraftVersion,
    normalizeLinkStyle,
    resolveNodeAnchorByEdge,
    resolveModuleByRef,
    resolveNodeAnchorFromDirection,
    resolveBusAnchorFromDirection,
    resolveModuleAnchorPoint,
    resolveLinkEndpointsForGeometry,
    ensureControlAnchorsForLink,
    buildOrthogonalPoints,
    buildPolylinePath,
    buildRoundedOrthogonalPath,
    buildLinkGeometryPath,
    nodeLinkDots,
    distancePointToSegment,
    findNodeByPoint,
    findBusByPoint,
    resolveNodeEdgeAnchorFromPointer,
    resolveDropTargetFromEvent,
    onNodeLinkPointerDown,
    onNodeLinkPointerMove,
    clearNodeLinkDraft,
    onNodeLinkPointerUp,
    addAnchorToLink,
  };
}