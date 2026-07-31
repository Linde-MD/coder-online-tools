import { ref } from 'vue';

export function useBoxSelection({
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
  let selectionState = null;

  function onSelectionPointerMove(event) {
    if (!selectionState) return;
    const point = resolvePointerInCanvas(event);
    if (!point) return;

    const rect = rectFromPoints(selectionState.start, point);
    selectionRect.value = rect;

    const hitIds = nodes.value
      .filter((node) => intersectsNode(rect, node))
      .map((node) => node.id);
    const hitBusIds = buses.value
      .filter((bus) => intersectsBus(rect, bus))
      .map((bus) => bus.id);

    if (selectionState.additive) {
      const merged = new Set(selectionState.baseline);
      for (const id of hitIds) merged.add(id);
      selectedIds.value = [...merged];

      const mergedBuses = new Set(selectionState.baselineBusIds);
      for (const id of hitBusIds) mergedBuses.add(id);
      setBusSelection([...mergedBuses], { sync: false });
    } else {
      selectedIds.value = hitIds;
      setBusSelection(hitBusIds, { sync: false });
    }
  }

  function stopBoxSelection() {
    const hasActiveSelection = Boolean(selectionState);
    selectionState = null;
    isBoxSelecting.value = false;
    selectionRect.value = null;
    syncBusDraftFromSelected();
    syncDraftFromSelected();
    window.removeEventListener('pointermove', onSelectionPointerMove);
    window.removeEventListener('pointerup', stopBoxSelection);
    document.removeEventListener('pointermove', onSelectionPointerMove);
    document.removeEventListener('pointerup', stopBoxSelection);

    if (hasActiveSelection && typeof setStatus === 'function') {
      const ecuCount = selectedIds.value.length;
      const busCount = selectedBusIds.value.length;
      const totalCount = ecuCount + busCount;
      setStatus(`框选完成：已选 ${totalCount} 项（ECU ${ecuCount} 个，CAN BUS ${busCount} 个）。`);
    }
  }

  function startBoxSelection(event) {
    const additive = event.ctrlKey || event.metaKey;
    const start = resolvePointerInCanvas(event);
    if (!start) return false;

    if (!additive) {
      selectedIds.value = [];
      setBusSelection([], { sync: false });
      syncBusDraftFromSelected();
      syncDraftFromSelected();
    }

    selectionState = {
      additive,
      start,
      baseline: new Set(selectedIds.value),
      baselineBusIds: new Set(selectedBusIds.value),
    };

    isBoxSelecting.value = true;
    selectionRect.value = { left: start.x, top: start.y, width: 0, height: 0 };

    window.addEventListener('pointermove', onSelectionPointerMove);
    window.addEventListener('pointerup', stopBoxSelection);
    document.addEventListener('pointermove', onSelectionPointerMove);
    document.addEventListener('pointerup', stopBoxSelection);
    return true;
  }

  return {
    selectionRect,
    isBoxSelecting,
    startBoxSelection,
    stopBoxSelection,
  };
}
