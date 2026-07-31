export function rectFromPoints(a, b) {
  const left = Math.min(a.x, b.x);
  const top = Math.min(a.y, b.y);
  const width = Math.abs(a.x - b.x);
  const height = Math.abs(a.y - b.y);
  return { left, top, width, height };
}

export function intersectsNode(rect, node, nodeWidth, nodeHeight) {
  const nodeRect = {
    left: node.position.x,
    top: node.position.y,
    right: node.position.x + nodeWidth,
    bottom: node.position.y + nodeHeight,
  };

  const selRect = {
    left: rect.left,
    top: rect.top,
    right: rect.left + rect.width,
    bottom: rect.top + rect.height,
  };

  return !(
    nodeRect.right < selRect.left ||
    nodeRect.left > selRect.right ||
    nodeRect.bottom < selRect.top ||
    nodeRect.top > selRect.bottom
  );
}

export function intersectsBus(rect, bus, busRadius) {
  const busRect = {
    left: bus.position.x,
    top: bus.position.y,
    right: bus.position.x + busRadius * 2,
    bottom: bus.position.y + busRadius * 2,
  };

  const selRect = {
    left: rect.left,
    top: rect.top,
    right: rect.left + rect.width,
    bottom: rect.top + rect.height,
  };

  return !(
    busRect.right < selRect.left ||
    busRect.left > selRect.right ||
    busRect.bottom < selRect.top ||
    busRect.top > selRect.bottom
  );
}

export function distancePointToSegment(point, a, b) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const apx = point.x - a.x;
  const apy = point.y - a.y;
  const ab2 = abx * abx + aby * aby || 1;
  const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / ab2));
  const proj = { x: a.x + abx * t, y: a.y + aby * t };
  const dx = point.x - proj.x;
  const dy = point.y - proj.y;
  return {
    dist: Math.sqrt(dx * dx + dy * dy),
    t,
  };
}

export function resolveNodeAnchorByEdge(node, edge, offsetRatio, nodeWidth, nodeHeight) {
  const ratio = Math.max(0, Math.min(1, Number.isFinite(Number(offsetRatio)) ? Number(offsetRatio) : 0.5));
  if (edge === 'left') {
    return {
      x: node.position.x,
      y: node.position.y + Math.round(nodeHeight * ratio),
    };
  }
  if (edge === 'top') {
    return {
      x: node.position.x + Math.round(nodeWidth * ratio),
      y: node.position.y,
    };
  }
  if (edge === 'bottom') {
    return {
      x: node.position.x + Math.round(nodeWidth * ratio),
      y: node.position.y + nodeHeight,
    };
  }
  return {
    x: node.position.x + nodeWidth,
    y: node.position.y + Math.round(nodeHeight * ratio),
  };
}

export function resolveNodeAnchorFromDirection(node, targetPoint, nodeWidth, nodeHeight) {
  const center = {
    x: node.position.x + nodeWidth / 2,
    y: node.position.y + nodeHeight / 2,
  };
  const dx = targetPoint.x - center.x;
  const dy = targetPoint.y - center.y;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);
  if (absDx >= absDy) {
    const edge = dx >= 0 ? 'right' : 'left';
    const offset = Math.max(0, Math.min(1, (targetPoint.y - node.position.y) / nodeHeight));
    return resolveNodeAnchorByEdge(node, edge, offset, nodeWidth, nodeHeight);
  }
  const edge = dy >= 0 ? 'bottom' : 'top';
  const offset = Math.max(0, Math.min(1, (targetPoint.x - node.position.x) / nodeWidth));
  return resolveNodeAnchorByEdge(node, edge, offset, nodeWidth, nodeHeight);
}

export function resolveBusAnchorFromDirection(bus, targetPoint, busRadius) {
  const cx = bus.position.x + busRadius;
  const cy = bus.position.y + busRadius;
  const dx = targetPoint.x - cx;
  const dy = targetPoint.y - cy;
  const length = Math.sqrt(dx * dx + dy * dy) || 1;
  return {
    x: cx + (dx / length) * busRadius,
    y: cy + (dy / length) * busRadius,
  };
}

export function resolveModuleAnchorPoint(type, module, anchorEdge, anchorOffset, targetPoint, nodeWidth, nodeHeight, busRadius) {
  if (!module) return null;
  if (type === 'node') {
    if (['left', 'right', 'top', 'bottom'].includes(anchorEdge)) {
      return resolveNodeAnchorByEdge(module, anchorEdge, anchorOffset, nodeWidth, nodeHeight);
    }
    return resolveNodeAnchorFromDirection(module, targetPoint, nodeWidth, nodeHeight);
  }
  return resolveBusAnchorFromDirection(module, targetPoint, busRadius);
}

export function resolveNodeEdgeAnchorFromPointer(node, pointer, nodeWidth, nodeHeight, edgeThreshold) {
  if (!pointer) return null;
  const localX = pointer.x - node.position.x;
  const localY = pointer.y - node.position.y;
  if (localX < 0 || localY < 0 || localX > nodeWidth || localY > nodeHeight) return null;

  const distances = [
    { edge: 'left', dist: localX },
    { edge: 'right', dist: nodeWidth - localX },
    { edge: 'top', dist: localY },
    { edge: 'bottom', dist: nodeHeight - localY },
  ].sort((a, b) => a.dist - b.dist);

  const nearest = distances[0];
  if (!nearest || nearest.dist > edgeThreshold) return null;

  if (nearest.edge === 'left' || nearest.edge === 'right') {
    const offset = Math.max(0, Math.min(1, localY / nodeHeight));
    return {
      edge: nearest.edge,
      offset,
      point: resolveNodeAnchorByEdge(node, nearest.edge, offset, nodeWidth, nodeHeight),
    };
  }

  const offset = Math.max(0, Math.min(1, localX / nodeWidth));
  return {
    edge: nearest.edge,
    offset,
    point: resolveNodeAnchorByEdge(node, nearest.edge, offset, nodeWidth, nodeHeight),
  };
}

export function buildOrthogonalPoints(start, end) {
  const midX = (start.x + end.x) / 2;
  return [
    { x: start.x, y: start.y },
    { x: midX, y: start.y },
    { x: midX, y: end.y },
    { x: end.x, y: end.y },
  ];
}

export function buildPolylinePath(points) {
  if (!points || points.length < 2) return '';
  return `M ${points[0].x} ${points[0].y} ${points.slice(1).map((p) => `L ${p.x} ${p.y}`).join(' ')}`;
}

export function buildRoundedOrthogonalPath(points, radius = 14) {
  if (!points || points.length < 2) return '';
  if (points.length < 3) return buildPolylinePath(points);

  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    const c = points[i + 1];
    const ab = { x: b.x - a.x, y: b.y - a.y };
    const bc = { x: c.x - b.x, y: c.y - b.y };
    const abLen = Math.sqrt(ab.x * ab.x + ab.y * ab.y) || 1;
    const bcLen = Math.sqrt(bc.x * bc.x + bc.y * bc.y) || 1;
    const r = Math.max(0, Math.min(radius, abLen / 2, bcLen / 2));
    const p1 = { x: b.x - (ab.x / abLen) * r, y: b.y - (ab.y / abLen) * r };
    const p2 = { x: b.x + (bc.x / bcLen) * r, y: b.y + (bc.y / bcLen) * r };
    path += ` L ${p1.x} ${p1.y} Q ${b.x} ${b.y} ${p2.x} ${p2.y}`;
  }
  const last = points[points.length - 1];
  path += ` L ${last.x} ${last.y}`;
  return path;
}

export function buildLinkGeometryPath(style, start, end, anchors, normalizeLinkStyle) {
  const cleanAnchors = Array.isArray(anchors)
    ? anchors
      .map((item) => ({ x: Number(item?.x), y: Number(item?.y) }))
      .filter((item) => Number.isFinite(item.x) && Number.isFinite(item.y))
    : [];

  const normalizedStyle = normalizeLinkStyle(style);
  const points = [start, ...cleanAnchors, end];

  if (normalizedStyle === 'curve') {
    if (cleanAnchors.length === 0) {
      const dx = end.x - start.x;
      const control = {
        x: start.x + dx * 0.5,
        y: start.y,
      };
      return {
        path: `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`,
        anchors: cleanAnchors,
      };
    }
    let path = `M ${start.x} ${start.y}`;
    let prev = start;
    for (let i = 0; i < cleanAnchors.length; i += 1) {
      const anchor = cleanAnchors[i];
      const next = i === cleanAnchors.length - 1 ? end : cleanAnchors[i + 1];
      const mid = {
        x: (anchor.x + next.x) / 2,
        y: (anchor.y + next.y) / 2,
      };
      if (i === 0) {
        path += ` Q ${anchor.x} ${anchor.y} ${mid.x} ${mid.y}`;
      } else {
        path += ` T ${mid.x} ${mid.y}`;
      }
      prev = mid;
    }
    if (prev.x !== end.x || prev.y !== end.y) {
      path += ` T ${end.x} ${end.y}`;
    }
    return {
      path,
      anchors: cleanAnchors,
    };
  }

  if (normalizedStyle === 'polyline') {
    return {
      path: buildPolylinePath(points),
      anchors: cleanAnchors,
    };
  }

  if (normalizedStyle === 'orthogonal') {
    if (cleanAnchors.length === 0) {
      const orthoPoints = buildOrthogonalPoints(start, end);
      return {
        path: buildPolylinePath(orthoPoints),
        anchors: [],
      };
    }
    const orthoPoints = [start];
    for (let i = 0; i < cleanAnchors.length; i += 1) {
      const a = cleanAnchors[i];
      const p = orthoPoints[orthoPoints.length - 1];
      orthoPoints.push({ x: a.x, y: p.y });
      orthoPoints.push({ x: a.x, y: a.y });
    }
    const last = orthoPoints[orthoPoints.length - 1];
    orthoPoints.push({ x: end.x, y: last.y });
    orthoPoints.push({ x: end.x, y: end.y });
    return {
      path: buildPolylinePath(orthoPoints),
      anchors: cleanAnchors,
    };
  }

  if (normalizedStyle === 'rounded') {
    if (cleanAnchors.length === 0) {
      const orthoPoints = buildOrthogonalPoints(start, end);
      return {
        path: buildRoundedOrthogonalPath(orthoPoints),
        anchors: [],
      };
    }
    const orthoPoints = [start];
    for (let i = 0; i < cleanAnchors.length; i += 1) {
      const a = cleanAnchors[i];
      const p = orthoPoints[orthoPoints.length - 1];
      orthoPoints.push({ x: a.x, y: p.y });
      orthoPoints.push({ x: a.x, y: a.y });
    }
    const last = orthoPoints[orthoPoints.length - 1];
    orthoPoints.push({ x: end.x, y: last.y });
    orthoPoints.push({ x: end.x, y: end.y });
    return {
      path: buildRoundedOrthogonalPath(orthoPoints),
      anchors: cleanAnchors,
    };
  }

  return {
    path: `M ${start.x} ${start.y} L ${end.x} ${end.y}`,
    anchors: [],
  };
}
