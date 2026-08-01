import { ref } from 'vue';

export function useLinkAnchorDrag({
  links,
  selectedLinkId,
  syncLinkEditorFromSelected,
  pushHistorySnapshot,
  persistNodes,
  resolvePointerInCanvas,
}) {
  const linkAnchorDragState = ref(null);

  function onLinkAnchorPointerDown(link, anchorIndex, event) {
    if (event.button !== 0) return;
    const point = resolvePointerInCanvas(event);
    if (!point) return;
    selectedLinkId.value = link.id;
    syncLinkEditorFromSelected();
    linkAnchorDragState.value = {
      linkId: link.id,
      anchorIndex,
      pointerId: event.pointerId,
      start: point,
      historyCaptured: false,
      pointerTarget: event.currentTarget,
    };
    event.currentTarget?.setPointerCapture?.(event.pointerId);
    window.addEventListener('pointermove', onLinkAnchorPointerMove);
    window.addEventListener('pointerup', onLinkAnchorPointerUp);
    document.addEventListener('pointermove', onLinkAnchorPointerMove);
    document.addEventListener('pointerup', onLinkAnchorPointerUp);
  }

  function onLinkAnchorPointerMove(event) {
    if (!linkAnchorDragState.value || linkAnchorDragState.value.pointerId !== event.pointerId) return;
    const point = resolvePointerInCanvas(event);
    if (!point) return;
    const target = links.value.find((item) => item.id === linkAnchorDragState.value.linkId);
    if (!target || !Array.isArray(target.anchors)) return;
    if (!target.anchors[linkAnchorDragState.value.anchorIndex]) return;
    if (!linkAnchorDragState.value.historyCaptured) {
      pushHistorySnapshot();
      linkAnchorDragState.value.historyCaptured = true;
    }
    target.anchors[linkAnchorDragState.value.anchorIndex] = {
      x: Math.round(point.x),
      y: Math.round(point.y),
    };
  }

  function onLinkAnchorPointerUp(event) {
    if (!linkAnchorDragState.value || (event && linkAnchorDragState.value.pointerId !== event.pointerId)) return;
    linkAnchorDragState.value.pointerTarget?.releasePointerCapture?.(linkAnchorDragState.value.pointerId);
    linkAnchorDragState.value = null;
    persistNodes();
    window.removeEventListener('pointermove', onLinkAnchorPointerMove);
    window.removeEventListener('pointerup', onLinkAnchorPointerUp);
    document.removeEventListener('pointermove', onLinkAnchorPointerMove);
    document.removeEventListener('pointerup', onLinkAnchorPointerUp);
  }

  function onLinkAnchorPointerCancel(event) {
    if (!linkAnchorDragState.value || linkAnchorDragState.value.pointerId !== event.pointerId) return;
    onLinkAnchorPointerUp(event);
  }

  function onLinkAnchorLostPointerCapture(event) {
    if (!linkAnchorDragState.value || linkAnchorDragState.value.pointerId !== event.pointerId) return;
    onLinkAnchorPointerUp(event);
  }

  return {
    linkAnchorDragState,
    onLinkAnchorPointerDown,
    onLinkAnchorPointerMove,
    onLinkAnchorPointerUp,
    onLinkAnchorPointerCancel,
    onLinkAnchorLostPointerCapture,
  };
}