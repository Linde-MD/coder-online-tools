import { ref } from 'vue';
import { PointerDragController } from '../../infra/index.js';

export function useBoxSelectionController({
  nodes,
  buses,
  selectedIds,
  selectedBusIds,
  setBusSelection,
  setStatus,
  resolvePointerInCanvas,
  rectFromPoints,
  intersectsNode,
  intersectsBus,
  syncBusDraftFromSelected,
  syncDraftFromSelected,
}) {
  const selectionRect = ref(null);
  const isBoxSelecting = ref(false);

  const drag = new PointerDragController({
    onStart: (event) => {
      const additive = event.ctrlKey || event.metaKey;
      const start = resolvePointerInCanvas(event);
      if (!start) return false;

      if (!additive) {
        selectedIds.value = [];
        setBusSelection([], { sync: false });
        syncBusDraftFromSelected();
        syncDraftFromSelected();
      }
      return {
        additive,
        start,
        baseline: new Set(selectedIds.value),
        baselineBusIds: new Set(selectedBusIds.value),
      };
    },
    onMove: (event, { state }) => {
      const point = resolvePointerInCanvas(event);
      if (!point || !state?.ctx) return;
      const { additive, start, baseline, baselineBusIds } = state.ctx;
      const rect = rectFromPoints(start, point);
      selectionRect.value = rect;

      const hitIds = nodes.value.filter((node) => intersectsNode(rect, node)).map((node) => node.id);
      const hitBusIds = buses.value.filter((bus) => intersectsBus(rect, bus)).map((bus) => bus.id);

      if (additive) {
        const merged = new Set(baseline);
        for (const id of hitIds) merged.add(id);
        selectedIds.value = [...merged];

        const mergedBuses = new Set(baselineBusIds);
        for (const id of hitBusIds) mergedBuses.add(id);
        setBusSelection([...mergedBuses], { sync: false });
      } else {
        selectedIds.value = hitIds;
        setBusSelection(hitBusIds, { sync: false });
      }
    },
    onEnd: (event, { moved, cancelled }) => {
      isBoxSelecting.value = false;
      const hadActive = selectionRect.value != null;
      selectionRect.value = null;
      syncBusDraftFromSelected();
      syncDraftFromSelected();

      if (hadActive && moved && !cancelled && typeof setStatus === 'function') {
        const ecuCount = selectedIds.value.length;
        const busCount = selectedBusIds.value.length;
        const totalCount = ecuCount + busCount;
        setStatus(`框选完成：已选 ${totalCount} 项（ECU ${ecuCount} 个，CAN BUS ${busCount} 个）。`);
      }
    },
  });

  function startBoxSelection(event) {
    if (!drag.start(event)) return false;
    const ctx = drag._state?.ctx;
    if (ctx) {
      isBoxSelecting.value = true;
      selectionRect.value = { left: ctx.start.x, top: ctx.start.y, width: 0, height: 0 };
    }
    return true;
  }

  function stopBoxSelection() {
    drag.cancel();
  }

  return {
    selectionRect,
    isBoxSelecting,
    startBoxSelection,
    stopBoxSelection,
  };
}