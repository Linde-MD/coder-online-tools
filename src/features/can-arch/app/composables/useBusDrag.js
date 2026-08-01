import { ref } from 'vue';
import { BUS_RADIUS } from '@/features/can-arch/domain/can-arch-constants.js';

export function useBusDrag({
  buses,
  selectedBusIds,
  selectedIds,
  selectedLinkId,
  linkHoverBusId,
  setStatus,
  closeContextMenu,
  setBusSelection,
  syncDraftFromSelected,
  syncBusDraftFromSelected,
  onDragStart,
  onDragEnd,
  resolvePointerInCanvas,
}) {
  const busDragState = ref(null);

  function resolveBusRimAnchorFromPointer(bus, pointer) {
    if (!pointer) return null;
    const cx = bus.position.x + BUS_RADIUS;
    const cy = bus.position.y + BUS_RADIUS;
    const dx = pointer.x - cx;
    const dy = pointer.y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < BUS_RADIUS - 16 || dist > BUS_RADIUS + 16) return null;
    const length = dist || 1;
    return {
      point: {
        x: cx + (dx / length) * BUS_RADIUS,
        y: cy + (dy / length) * BUS_RADIUS,
      },
    };
  }

  function onBusPointerDown(bus, event) {
    if (busDragState.value) {
      finishBusDrag();
    }
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    closeContextMenu();
    selectedLinkId.value = '';
    if (selectedIds.value.length > 0) {
      selectedIds.value = [];
      syncDraftFromSelected();
    }

    const pointerPoint = resolvePointerInCanvas(event);
    const rimAnchor = resolveBusRimAnchorFromPointer(bus, pointerPoint);
    if (rimAnchor) {
      linkHoverBusId.value = bus.id;
      if (!selectedBusIds.value.includes(bus.id)) {
        setBusSelection([bus.id], { sync: false });
        syncBusDraftFromSelected();
      }
      return;
    }
    linkHoverBusId.value = '';

    const additive = event.ctrlKey || event.metaKey;
    if (additive) {
      const exists = selectedBusIds.value.includes(bus.id);
      if (exists) {
        setBusSelection(selectedBusIds.value.filter((item) => item !== bus.id), { sync: false });
      } else {
        setBusSelection([...selectedBusIds.value, bus.id], { sync: false });
      }
      syncBusDraftFromSelected();
      return;
    }

    if (!selectedBusIds.value.includes(bus.id)) {
      setBusSelection([bus.id], { sync: false });
      syncBusDraftFromSelected();
    }

    const dragIds = selectedBusIds.value.includes(bus.id) ? [...selectedBusIds.value] : [bus.id];
    const startPoint = pointerPoint || resolvePointerInCanvas(event);
    if (!startPoint) return;

    const startMap = new Map();
    for (const id of dragIds) {
      const found = buses.value.find((item) => item.id === id);
      if (!found) continue;
      startMap.set(id, { x: found.position.x, y: found.position.y });
    }

    busDragState.value = {
      startX: startPoint.x,
      startY: startPoint.y,
      dragIds,
      startMap,
      pointerId: event.pointerId,
      pointerTarget: event.currentTarget,
      historyCaptured: false,
    };

    event.currentTarget?.setPointerCapture?.(event.pointerId);
    setStatus(`开始拖拽 ${bus.name}`);

    window.addEventListener('pointermove', onBusPointerMove);
    window.addEventListener('pointerup', onBusPointerUpCapture);
    document.addEventListener('pointermove', onBusPointerMove);
    document.addEventListener('pointerup', onBusPointerUpCapture);

    onDragStart?.(busDragState.value);
  }

  function onBusPointerMove(event, busArg = null) {
    if (busDragState.value && busDragState.value.pointerId === event.pointerId) {
      const pointerPoint = resolvePointerInCanvas(event);
      if (!pointerPoint) return;
      const dx = pointerPoint.x - busDragState.value.startX;
      const dy = pointerPoint.y - busDragState.value.startY;

      if (!busDragState.value.historyCaptured) {
        busDragState.value.historyCaptured = true;
        onDragStart?.(busDragState.value, true);
      }

      for (const [id, startPos] of busDragState.value.startMap) {
        const bus = buses.value.find((item) => item.id === id);
        if (!bus) continue;
        const maxX = 4000;
        const maxY = 3000;
        bus.position.x = Math.max(0, Math.min(maxX, Math.round(startPos.x + dx)));
        bus.position.y = Math.max(0, Math.min(maxY, Math.round(startPos.y + dy)));
      }
      return;
    }

    if (busArg) {
      _updateBusRimHover(busArg, event);
    }
  }

  function _updateBusRimHover(bus, event) {
    if (busDragState.value) return;
    const point = resolvePointerInCanvas(event);
    const rimAnchor = resolveBusRimAnchorFromPointer(bus, point);
    if (rimAnchor) {
      linkHoverBusId.value = bus.id;
      return;
    }
    if (linkHoverBusId.value === bus.id) {
      linkHoverBusId.value = '';
    }
  }

  function onBusPointerLeave(bus) {
    if (linkHoverBusId.value === bus.id) {
      linkHoverBusId.value = '';
    }
  }

  function finishBusDrag() {
    if (!busDragState.value) return;
    window.removeEventListener('pointermove', onBusPointerMove);
    window.removeEventListener('pointerup', onBusPointerUpCapture);
    document.removeEventListener('pointermove', onBusPointerMove);
    document.removeEventListener('pointerup', onBusPointerUpCapture);
    busDragState.value = null;
  }

  function onBusPointerUpCapture(event) {
    if (!busDragState.value || busDragState.value.pointerId !== event.pointerId) return;
    finishBusDrag();
    onDragEnd?.();
  }

  function onBusPointerUp(bus, event) {
    if (event.button === 0 && busDragState.value && busDragState.value.pointerId === event.pointerId) {
      finishBusDrag();
      onDragEnd?.();
      return;
    }
    if (event.button !== 2) return;
    event.preventDefault();
    event.stopPropagation();
  }

  function onBusPointerCancel(event) {
    if (!busDragState.value || busDragState.value.pointerId !== event.pointerId) return;
    finishBusDrag();
    onDragEnd?.();
  }

  function onBusLostPointerCapture(event) {
    if (!busDragState.value || busDragState.value.pointerId !== event.pointerId) return;
    finishBusDrag();
    onDragEnd?.();
  }

  return {
    busDragState,
    onBusPointerDown,
    onBusPointerMove,
    onBusPointerLeave,
    onBusPointerUp,
    onBusPointerCancel,
    onBusLostPointerCapture,
    finishBusDrag,
    resolveBusRimAnchorFromPointer,
  };
}