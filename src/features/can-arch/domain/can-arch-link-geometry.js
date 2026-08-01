import {
  buildLinkGeometryPath as geometryBuildLinkGeometryPath,
  buildOrthogonalPoints as geometryBuildOrthogonalPoints,
  buildPolylinePath as geometryBuildPolylinePath,
  buildRoundedOrthogonalPath as geometryBuildRoundedOrthogonalPath,
  distancePointToSegment as geometryDistancePointToSegment,
  resolveBusAnchorFromDirection as geometryResolveBusAnchorFromDirection,
  resolveModuleAnchorPoint as geometryResolveModuleAnchorPoint,
  resolveNodeAnchorByEdge as geometryResolveNodeAnchorByEdge,
  resolveNodeAnchorFromDirection as geometryResolveNodeAnchorFromDirection,
} from './can-arch-geometry.js';
import {
  BUS_RADIUS,
  NODE_HEIGHT,
  NODE_WIDTH,
} from './can-arch-constants.js';

export function resolveNodeAnchorByEdge(node, edge, offsetRatio) {
  return geometryResolveNodeAnchorByEdge(node, edge, offsetRatio, NODE_WIDTH, NODE_HEIGHT);
}

export function resolveNodeAnchorFromDirection(node, targetPoint) {
  return geometryResolveNodeAnchorFromDirection(node, targetPoint, NODE_WIDTH, NODE_HEIGHT);
}

export function resolveBusAnchorFromDirection(bus, targetPoint) {
  return geometryResolveBusAnchorFromDirection(bus, targetPoint, BUS_RADIUS);
}

export function resolveModuleAnchorPoint(type, module, anchorEdge, anchorOffset, targetPoint) {
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

export function resolveLinkEndpointsForGeometry(link, resolveModuleByRef) {
  const fromType = link?.fromType || 'node';
  const toType = link?.toType || 'bus';
  const fromId = link?.fromId || link?.nodeId;
  const toId = link?.toId || link?.busId;
  const fromModule = resolveModuleByRef(fromType, fromId);
  const toModule = resolveModuleByRef(toType, toId);
  if (!fromModule || !toModule) return null;

  const fromCenter = fromType === 'node'
    ? { x: fromModule.position.x + NODE_WIDTH / 2, y: fromModule.position.y + NODE_HEIGHT / 2 }
    : { x: fromModule.position.x + BUS_RADIUS, y: fromModule.position.y + BUS_RADIUS };
  const toCenter = toType === 'node'
    ? { x: toModule.position.x + NODE_WIDTH / 2, y: toModule.position.y + NODE_HEIGHT / 2 }
    : { x: toModule.position.x + BUS_RADIUS, y: toModule.position.y + BUS_RADIUS };

  const start = resolveModuleAnchorPoint(fromType, fromModule, link.fromAnchorEdge, link.fromAnchorOffset, toCenter);
  const end = resolveModuleAnchorPoint(toType, toModule, link.toAnchorEdge, link.toAnchorOffset, fromCenter);
  if (!start || !end) return null;

  return { start, end };
}

export function buildOrthogonalPoints(start, end) {
  return geometryBuildOrthogonalPoints(start, end);
}

export function buildPolylinePath(points) {
  return geometryBuildPolylinePath(points);
}

export function buildRoundedOrthogonalPath(points, radius = 14) {
  return geometryBuildRoundedOrthogonalPath(points, radius);
}

export function buildLinkGeometryPath(style, start, end, anchors, normalizeLinkStyle) {
  return geometryBuildLinkGeometryPath(style, start, end, anchors, normalizeLinkStyle);
}

export function distancePointToSegment(point, a, b) {
  return geometryDistancePointToSegment(point, a, b);
}

export function defaultAnchorsForLink(link, resolveModuleByRef, normalizeLinkStyle) {
  if (!link) return [];
  const style = normalizeLinkStyle(link.style);
  if (!['curve', 'rounded', 'orthogonal'].includes(style)) return [];
  const endpoints = resolveLinkEndpointsForGeometry(link, resolveModuleByRef);
  if (!endpoints) return [];
  const sx = endpoints.start.x;
  const sy = endpoints.start.y;
  const ex = endpoints.end.x;
  const ey = endpoints.end.y;
  const dx = ex - sx;
  const dy = ey - sy;
  const distance = Math.sqrt(dx * dx + dy * dy) || 1;
  const unitPerp = { x: -dy / distance, y: dx / distance };
  const curveLift = Math.max(16, Math.min(44, distance * 0.15));

  if (style === 'curve') {
    return [
      { x: Math.round(sx + dx * 0.33 + unitPerp.x * curveLift), y: Math.round(sy + dy * 0.33 + unitPerp.y * curveLift) },
      { x: Math.round(sx + dx * 0.67 - unitPerp.x * curveLift), y: Math.round(sy + dy * 0.67 - unitPerp.y * curveLift) },
    ];
  }

  return [
    { x: Math.round(sx + dx * 0.33), y: Math.round(sy + dy * 0.33) },
    { x: Math.round(sx + dx * 0.67), y: Math.round(sy + dy * 0.67) },
  ];
}

export function ensureControlAnchorsForLink(link, resolveModuleByRef, normalizeLinkStyle) {
  if (!link) return;
  const style = normalizeLinkStyle(link.style);
  if (!['curve', 'rounded', 'orthogonal'].includes(style)) return;
  const minAnchorCount = style === 'curve' ? 2 : 2;
  const existingAnchors = Array.isArray(link.anchors)
    ? link.anchors
      .map((item) => ({ x: Number(item?.x), y: Number(item?.y) }))
      .filter((item) => Number.isFinite(item.x) && Number.isFinite(item.y))
    : [];
  if (existingAnchors.length >= minAnchorCount) {
    link.anchors = existingAnchors;
    return;
  }

  const defaults = defaultAnchorsForLink(link, resolveModuleByRef, normalizeLinkStyle);
  const nextAnchors = [...existingAnchors];
  let fallbackIndex = 0;
  while (nextAnchors.length < minAnchorCount) {
    const fallback = defaults[Math.min(fallbackIndex, defaults.length - 1)] || null;
    if (fallback) {
      nextAnchors.push({ ...fallback });
    } else {
      nextAnchors.push({
        x: Math.round((link.anchors?.[0]?.x ?? 0)),
        y: Math.round((link.anchors?.[0]?.y ?? 0)),
      });
    }
    fallbackIndex += 1;
  }
  link.anchors = nextAnchors;
}

export function buildResolvedLinks(links, nodes, buses, normalizeLinkStyle, findBusColor) {
  const geometries = [];
  for (const link of links) {
    const fromType = link.fromType || 'node';
    const toType = link.toType || 'bus';
    const fromId = link.fromId || link.nodeId;
    const toId = link.toId || link.busId;
    const fromModule = fromType === 'node'
      ? (nodes || []).find((item) => item.id === fromId) || null
      : (buses || []).find((item) => item.id === fromId) || null;
    const toModule = toType === 'node'
      ? (nodes || []).find((item) => item.id === toId) || null
      : (buses || []).find((item) => item.id === toId) || null;
    if (!fromModule || !toModule) continue;

    const fromCenter = fromType === 'node'
      ? { x: fromModule.position.x + NODE_WIDTH / 2, y: fromModule.position.y + NODE_HEIGHT / 2 }
      : { x: fromModule.position.x + BUS_RADIUS, y: fromModule.position.y + BUS_RADIUS };
    const toCenter = toType === 'node'
      ? { x: toModule.position.x + NODE_WIDTH / 2, y: toModule.position.y + NODE_HEIGHT / 2 }
      : { x: toModule.position.x + BUS_RADIUS, y: toModule.position.y + BUS_RADIUS };

    const start = resolveModuleAnchorPoint(fromType, fromModule, link.fromAnchorEdge, link.fromAnchorOffset, toCenter);
    const end = resolveModuleAnchorPoint(toType, toModule, link.toAnchorEdge, link.toAnchorOffset, fromCenter);
    if (!start || !end) continue;

    const style = normalizeLinkStyle(link.style);
    const rendered = buildLinkGeometryPath(style, start, end, link.anchors, normalizeLinkStyle);
    const color = findBusColor ? findBusColor(link, fromModule, toModule) : '#395f89';

    geometries.push({
      id: link.id,
      fromType,
      fromId,
      toType,
      toId,
      style,
      path: rendered.path,
      anchors: rendered.anchors,
      color,
      start,
      end,
    });
  }
  return geometries;
}

export function nodeLinkDots(node, resolvedLinks) {
  const dots = [];
  for (const link of resolvedLinks) {
    if (link.fromType === 'node' && link.fromId === node.id) {
      const localX = link.start.x - node.position.x;
      const localY = link.start.y - node.position.y;
      dots.push({
        key: `dot-${link.id}-s`,
        left: Math.max(0, Math.min(NODE_WIDTH - 8, localX - 4)),
        top: Math.max(0, Math.min(NODE_HEIGHT - 8, localY - 4)),
      });
    }
    if (link.toType === 'node' && link.toId === node.id) {
      const localX = link.end.x - node.position.x;
      const localY = link.end.y - node.position.y;
      dots.push({
        key: `dot-${link.id}-e`,
        left: Math.max(0, Math.min(NODE_WIDTH - 8, localX - 4)),
        top: Math.max(0, Math.min(NODE_HEIGHT - 8, localY - 4)),
      });
    }
  }
  return dots;
}

export function findBusByPoint(point, buses, excludeBusId = '') {
  if (!point) return null;
  let best = null;
  let bestDist = Infinity;
  for (const bus of buses) {
    if (excludeBusId && bus.id === excludeBusId) continue;
    const cx = bus.position.x + BUS_RADIUS;
    const cy = bus.position.y + BUS_RADIUS;
    const dx = point.x - cx;
    const dy = point.y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist <= BUS_RADIUS + 30 && dist < bestDist) {
      best = bus;
      bestDist = dist;
    }
  }
  return best;
}

export function addAnchorToLink(link, geometry, point, distancePointToSegmentFn) {
  if (!link || !geometry || !point) return;
  if (!Array.isArray(link.anchors)) link.anchors = [];

  const points = [geometry.start, ...(link.anchors || []), geometry.end];
  let insertIndex = link.anchors.length;
  let bestDist = Infinity;
  for (let i = 0; i < points.length - 1; i += 1) {
    const hit = distancePointToSegmentFn
      ? distancePointToSegmentFn(point, points[i], points[i + 1])
      : { dist: 0 };
    if (hit.dist < bestDist) {
      bestDist = hit.dist;
      insertIndex = i;
    }
  }

  let nextAnchor = {
    x: Math.round(point.x),
    y: Math.round(point.y),
  };
  const overlapCount = link.anchors.filter((anchor) => {
    const dx = Number(anchor?.x) - nextAnchor.x;
    const dy = Number(anchor?.y) - nextAnchor.y;
    return Math.sqrt(dx * dx + dy * dy) < 8;
  }).length;
  if (overlapCount > 0) {
    nextAnchor = {
      x: nextAnchor.x + overlapCount * 12,
      y: nextAnchor.y + overlapCount * 8,
    };
  }

  link.anchors.splice(insertIndex, 0, nextAnchor);
}

export function findNodeByPoint(point, nodes, excludeNodeId = '') {
  if (!point) return null;
  let best = null;
  let bestDist = Infinity;
  for (const node of nodes) {
    if (excludeNodeId && node.id === excludeNodeId) continue;
    const inside = point.x >= node.position.x - 10 && point.x <= node.position.x + NODE_WIDTH + 10 &&
      point.y >= node.position.y - 10 && point.y <= node.position.y + NODE_HEIGHT + 10;
    if (!inside) continue;
    const cx = node.position.x + NODE_WIDTH / 2;
    const cy = node.position.y + NODE_HEIGHT / 2;
    const dx = point.x - cx;
    const dy = point.y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < bestDist) {
      best = node;
      bestDist = dist;
    }
  }
  return best;
}