import { ref } from 'vue';
import { NODE_EDGE_LINK_HIT_THRESHOLD, NODE_HEIGHT, NODE_WIDTH } from '@/features/can-arch/domain/can-arch-constants.js';
import { resolveNodeEdgeAnchorFromPointer as geometryResolveNodeEdgeAnchorFromPointer } from '@/features/can-arch/domain/can-arch-geometry.js';

export function useNodeDrag({
  nodes,
  selectedIds,
  selectedBusIds,
  linkHoverNodeEdge,
  linkHoverBusId,
  selectedLinkId,
  setStatus,
  closeContextMenu,
  clearBusSelection,
  syncDraftFromSelected,
  syncBusDraftFromSelected,
  onStartLinkDraft,
  onSelectionChanged,
  onDragStart,
  onDragEnd,
  resolvePointerInCanvas,
}) {
  const dragState = ref(null);

  function resolveNodeEdgeAnchorFromPointer(node, pointer) {
    return geometryResolveNodeEdgeAnchorFromPointer(
      node,
      pointer,
      NODE_WIDTH,
      NODE_HEIGHT,
      NODE_EDGE_LINK_HIT_THRESHOLD,
    );
  }

  function _isAlreadySelectedNode(nodeId) {
    return selectedIds.value.includes(nodeId);
  }

  function _updateNodeEdgeHover(node, event) {
    const point = resolvePointerInCanvas(event);
    const edgeAnchor = resolveNodeEdgeAnchorFromPointer(node, point);
    if (edgeAnchor) {
      linkHoverNodeEdge.nodeId = node.id;
      linkHoverNodeEdge.edge = edgeAnchor.edge;
      return;
    }
    if (linkHoverNodeEdge.nodeId === node.id) {
      linkHoverNodeEdge.nodeId = '';
      linkHoverNodeEdge.edge = '';
    }
  }

  function _clearNodeEdgeHover(node) {
    if (linkHoverNodeEdge.nodeId === node.id) {
      linkHoverNodeEdge.nodeId = '';
      linkHoverNodeEdge.edge = '';
    }
  }

  function onNodePointerDown(node, event) {
    if (dragState.value) {
      onDragEnd();
    }
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    closeContextMenu();
    linkHoverBusId.value = '';
    selectedLinkId.value = '';
    if (selectedBusIds.value.length > 0) {
      clearBusSelection({ sync: false });
      syncBusDraftFromSelected();
    }

    const pointerPoint = resolvePointerInCanvas(event);
    const edgeAnchor = resolveNodeEdgeAnchorFromPointer(node, pointerPoint);
    if (edgeAnchor) {
      linkHoverNodeEdge.nodeId = node.id;
      linkHoverNodeEdge.edge = edgeAnchor.edge;
      if (!_isAlreadySelectedNode(node.id)) {
        selectedIds.value = [node.id];
        syncDraftFromSelected();
      }
      onStartLinkDraft(node, event, edgeAnchor);
      return;
    }
    linkHoverNodeEdge.nodeId = '';
    linkHoverNodeEdge.edge = '';

    const additive = event.ctrlKey || event.metaKey;

    if (additive) {
      const exists = _isAlreadySelectedNode(node.id);
      if (exists) {
        selectedIds.value = selectedIds.value.filter((item) => item !== node.id);
      } else {
        selectedIds.value = [...selectedIds.value, node.id];
      }
      syncDraftFromSelected();
      onSelectionChanged();
      return;
    }

    if (!_isAlreadySelectedNode(node.id)) {
      selectedIds.value = [node.id];
      syncDraftFromSelected();
      onSelectionChanged();
    }

    const dragIds = _isAlreadySelectedNode(node.id) ? [...selectedIds.value] : [node.id];
    const startPoint = pointerPoint || resolvePointerInCanvas(event);
    if (!startPoint) return;

    const startMap = new Map();
    for (const id of dragIds) {
      const found = nodes.value.find((item) => item.id === id);
      if (!found) continue;
      startMap.set(id, { x: found.position.x, y: found.position.y });
    }

    dragState.value = {
      startX: startPoint.x,
      startY: startPoint.y,
      dragIds,
      startMap,
      pointerId: event.pointerId,
      pointerTarget: event.currentTarget,
      historyCaptured: false,
    };

    event.currentTarget?.setPointerCapture?.(event.pointerId);
    setStatus(`开始拖拽 ${node.name}`);

    window.addEventListener('pointermove', onNodePointerMove);
    window.addEventListener('pointerup', onNodePointerUp);
    document.addEventListener('pointermove', onNodePointerMove);
    document.addEventListener('pointerup', onNodePointerUp);

    onDragStart(dragState.value);
  }

  function onNodePointerMove(event) {
    if (dragState.value && dragState.value.pointerId === event.pointerId) {
      onDragMove(event, dragState.value);
      return;
    }
    const nodeId = event.currentTarget?.getAttribute?.('data-node-id') || '';
    if (!nodeId) return;
    const node = nodes.value.find((item) => item.id === nodeId);
    if (!node) return;
    _updateNodeEdgeHover(node, event);
  }

  function onNodePointerLeave(node) {
    _clearNodeEdgeHover(node);
  }

  function onNodePointerUp(node, event) {
    if (event.button === 0 && dragState.value && dragState.value.pointerId === event.pointerId) {
      onDragEnd();
      return;
    }
    if (event.button !== 2) return;
    event.preventDefault();
    event.stopPropagation();
  }

  function onNodePointerCancel(event) {
    if (!dragState.value || dragState.value.pointerId !== event.pointerId) return;
    onDragEnd();
  }

  function onNodeLostPointerCapture(event) {
    if (!dragState.value || dragState.value.pointerId !== event.pointerId) return;
    onDragEnd();
  }

  function onDragMove(event, currentDragState) {
    if (!currentDragState) return;
    const pointerPoint = resolvePointerInCanvas(event);
    if (!pointerPoint) return;
    const dx = pointerPoint.x - currentDragState.startX;
    const dy = pointerPoint.y - currentDragState.startY;

    if (!currentDragState.historyCaptured) {
      currentDragState.historyCaptured = true;
      onDragStart(currentDragState);
    }

    for (const [id, startPos] of currentDragState.startMap) {
      const node = nodes.value.find((item) => item.id === id);
      if (!node) continue;
      const maxX = 4000;
      const maxY = 3000;
      node.position.x = Math.max(0, Math.min(maxX, Math.round(startPos.x + dx)));
      node.position.y = Math.max(0, Math.min(maxY, Math.round(startPos.y + dy)));
    }
  }

  function onDragEnd() {
    if (!dragState.value) return;
    window.removeEventListener('pointermove', onNodePointerMove);
    window.removeEventListener('pointerup', onNodePointerUp);
    document.removeEventListener('pointermove', onNodePointerMove);
    document.removeEventListener('pointerup', onNodePointerUp);
    dragState.value = null;
  }

  return {
    dragState,
    onNodePointerDown,
    onNodePointerMove,
    onNodePointerLeave,
    onNodePointerUp,
    onNodePointerCancel,
    onNodeLostPointerCapture,
    resolveNodeEdgeAnchorFromPointer,
  };
}