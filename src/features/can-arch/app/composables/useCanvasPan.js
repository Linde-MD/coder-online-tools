import { ref } from 'vue';

export function useCanvasPan({
  nodes,
  buses,
  links,
  selectedIds,
  clearBusSelection,
  syncDraftFromSelected,
  syncBusDraftFromSelected,
  pushHistorySnapshot,
  persistNodes,
  nowIso,
}) {
  const isCanvasPanning = ref(false);
  let canvasPanState = null;

  function onCanvasPanPointerMove(event) {
    if (!canvasPanState) return;
    if (canvasPanState.pointerId !== event.pointerId) return;

    const dx = event.clientX - canvasPanState.startClientX;
    const dy = event.clientY - canvasPanState.startClientY;
    if (!canvasPanState.moved && (Math.abs(dx) > 2 || Math.abs(dy) > 2)) {
      canvasPanState.moved = true;
    }

    if (canvasPanState.moved && !canvasPanState.historyCaptured) {
      pushHistorySnapshot();
      canvasPanState.historyCaptured = true;
    }

    for (const node of nodes.value) {
      const start = canvasPanState.startMap.get(node.id);
      if (!start) continue;
      node.position.x = Math.round(start.x + dx);
      node.position.y = Math.round(start.y + dy);
      node.updatedAt = nowIso();
    }
    for (const bus of buses.value) {
      const start = canvasPanState.busStartMap.get(bus.id);
      if (!start) continue;
      bus.position.x = Math.round(start.x + dx);
      bus.position.y = Math.round(start.y + dy);
    }
    for (const link of links.value) {
      if (!Array.isArray(link.anchors) || link.anchors.length === 0) continue;
      const startAnchors = canvasPanState.linkAnchorStartMap.get(link.id) || [];
      link.anchors = startAnchors.map((anchor) => ({
        x: Math.round(anchor.x + dx),
        y: Math.round(anchor.y + dy),
      }));
    }
  }

  function stopCanvasPan(event) {
    if (!canvasPanState) return;
    if (event && canvasPanState.pointerId !== event.pointerId) return;

    const hadMoved = canvasPanState.moved;
    const keepSelection = canvasPanState.keepSelection;
    canvasPanState.pointerTarget?.releasePointerCapture?.(canvasPanState.pointerId);
    canvasPanState = null;
    isCanvasPanning.value = false;
    window.removeEventListener('pointermove', onCanvasPanPointerMove);
    window.removeEventListener('pointerup', stopCanvasPan);
    document.removeEventListener('pointermove', onCanvasPanPointerMove);
    document.removeEventListener('pointerup', stopCanvasPan);

    if (!hadMoved && !keepSelection) {
      selectedIds.value = [];
      clearBusSelection({ sync: false });
      syncDraftFromSelected();
      syncBusDraftFromSelected();
      return;
    }

    if (hadMoved) {
      persistNodes();
    }
  }

  function startCanvasPan(event) {
    canvasPanState = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startMap: new Map(nodes.value.map((item) => [item.id, { x: item.position.x, y: item.position.y }])),
      busStartMap: new Map(buses.value.map((item) => [item.id, { x: item.position.x, y: item.position.y }])),
      linkAnchorStartMap: new Map(links.value.map((item) => [
        item.id,
        Array.isArray(item.anchors)
          ? item.anchors.map((anchor) => ({ x: Number(anchor?.x) || 0, y: Number(anchor?.y) || 0 }))
          : [],
      ])),
      moved: false,
      historyCaptured: false,
      keepSelection: event.ctrlKey || event.metaKey,
      pointerTarget: event.currentTarget,
    };

    isCanvasPanning.value = true;
    event.currentTarget?.setPointerCapture?.(event.pointerId);
    window.addEventListener('pointermove', onCanvasPanPointerMove);
    window.addEventListener('pointerup', stopCanvasPan);
    document.addEventListener('pointermove', onCanvasPanPointerMove);
    document.addEventListener('pointerup', stopCanvasPan);
  }

  function onCanvasPanPointerCancel() {
    stopCanvasPan();
  }

  function onCanvasPanLostCapture(event) {
    if (!canvasPanState || canvasPanState.pointerId !== event.pointerId) return;
    stopCanvasPan();
  }

  function isPanning() {
    return Boolean(canvasPanState);
  }

  return {
    isCanvasPanning,
    isPanning,
    startCanvasPan,
    stopCanvasPan,
    onCanvasPanPointerCancel,
    onCanvasPanLostCapture,
  };
}
