import { ref } from 'vue';
import { PointerDragController } from '../../infra/index.js';

export function useCanvasPanController({
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
  let _historyCaptured = false;
  let _keepSelection = false;
  let _moved = false;

  function _clonePositions() {
    const nodeMap = new Map(nodes.value.map((item) => [item.id, { x: item.position.x, y: item.position.y }]));
    const busMap = new Map(buses.value.map((item) => [item.id, { x: item.position.x, y: item.position.y }]));
    const linkAnchorMap = new Map(
      links.value.map((item) => [
        item.id,
        Array.isArray(item.anchors)
          ? item.anchors.map((anchor) => ({ x: Number(anchor?.x) || 0, y: Number(anchor?.y) || 0 }))
          : [],
      ])
    );
    return { nodeMap, busMap, linkAnchorMap };
  }

  function _applyDelta(dx, dy, startPositions) {
    const { nodeMap, busMap, linkAnchorMap } = startPositions;
    for (const node of nodes.value) {
      const start = nodeMap.get(node.id);
      if (!start) continue;
      node.position.x = Math.round(start.x + dx);
      node.position.y = Math.round(start.y + dy);
      node.updatedAt = nowIso();
    }
    for (const bus of buses.value) {
      const start = busMap.get(bus.id);
      if (!start) continue;
      bus.position.x = Math.round(start.x + dx);
      bus.position.y = Math.round(start.y + dy);
    }
    for (const link of links.value) {
      const startAnchors = linkAnchorMap.get(link.id) || [];
      link.anchors = startAnchors.map((anchor) => ({
        x: Math.round(anchor.x + dx),
        y: Math.round(anchor.y + dy),
      }));
    }
  }

  const drag = new PointerDragController({
    onStart: (event) => {
      _historyCaptured = false;
      _keepSelection = event.ctrlKey || event.metaKey;
      _moved = false;
      return _clonePositions();
    },
    onMove: (event, { dx, dy, ctx }) => {
      if (!_moved && (Math.abs(dx) > 2 || Math.abs(dy) > 2)) {
        _moved = true;
      }
      if (_moved && !_historyCaptured) {
        pushHistorySnapshot();
        _historyCaptured = true;
      }
      _applyDelta(dx, dy, ctx);
    },
    onEnd: (event, { moved }) => {
      isCanvasPanning.value = false;
      if (!moved && !_keepSelection) {
        selectedIds.value = [];
        clearBusSelection({ sync: false });
        syncDraftFromSelected();
        syncBusDraftFromSelected();
        return;
      }
      if (moved) {
        persistNodes();
      }
    },
  });

  function startCanvasPan(event) {
    if (drag.start(event)) {
      isCanvasPanning.value = true;
    }
  }

  function stopCanvasPan() {
    drag.cancel();
  }

  function isPanning() {
    return drag.isDragging;
  }

  return {
    isCanvasPanning,
    isPanning,
    startCanvasPan,
    stopCanvasPan,
    onCanvasPanPointerCancel: () => drag.cancel(),
    onCanvasPanLostCapture: () => drag.cancel(),
  };
}