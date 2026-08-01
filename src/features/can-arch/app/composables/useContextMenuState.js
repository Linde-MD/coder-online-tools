import { ref } from 'vue';

export function useContextMenuState({ setStatus }) {
  const contextMenu = ref({
    open: false,
    x: 0,
    y: 0,
    target: 'canvas',
    nodeId: null,
    linkId: null,
    anchorIndex: -1,
    canvasPoint: null,
  });

  function closeContextMenu() {
    contextMenu.value.open = false;
    contextMenu.value.target = 'canvas';
    contextMenu.value.nodeId = null;
    contextMenu.value.linkId = null;
    contextMenu.value.anchorIndex = -1;
    contextMenu.value.canvasPoint = null;
  }

  function openContextMenuAt(x, y, target = 'canvas', nodeId = null, canvasPoint = null, linkId = null, anchorIndex = -1) {
    contextMenu.value = {
      open: true,
      x,
      y,
      target,
      nodeId,
      linkId,
      anchorIndex,
      canvasPoint,
    };
  }

  function openCanvasContextMenu(event, resolvePointerInCanvas) {
    const point = resolvePointerInCanvas(event);
    if (!point) return;
    openContextMenuAt(event.clientX, event.clientY, 'canvas', null, point);
    setStatus('已打开画布右键菜单。');
  }

  function onNodeContextMenu(node, event, options = {}) {
    const {
      clearBusSelection,
      syncBusDraftFromSelected,
      selectedIds,
      syncDraftFromSelected,
      resolvePointerInCanvas,
    } = options;
    clearBusSelection({ sync: false });
    syncBusDraftFromSelected();
    if (!selectedIds.value.includes(node.id)) {
      selectedIds.value = [node.id];
      syncDraftFromSelected();
    }
    const point = resolvePointerInCanvas(event);
    openContextMenuAt(event.clientX, event.clientY, 'node', node.id, point);
    setStatus(`已打开 ECU 右键菜单：${node.name}`);
  }

  function onBusContextMenu(bus, event, options = {}) {
    const { selectedBusId, setBusSelection, syncBusDraftFromSelected, resolvePointerInCanvas } = options;
    selectedBusId.value = bus.id;
    setBusSelection([bus.id], { sync: false });
    syncBusDraftFromSelected();
    const point = resolvePointerInCanvas(event);
    openContextMenuAt(event.clientX, event.clientY, 'bus', bus.id, point);
    setStatus(`已打开 CAN BUS 右键菜单：${bus.name}`);
  }

  return {
    contextMenu,
    closeContextMenu,
    openContextMenuAt,
    openCanvasContextMenu,
    onNodeContextMenu,
    onBusContextMenu,
  };
}