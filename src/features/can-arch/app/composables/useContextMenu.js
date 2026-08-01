import { ref, reactive, computed } from 'vue';

export function useContextMenu() {
  const contextMenu = reactive({
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
    contextMenu.open = false;
    contextMenu.target = 'canvas';
    contextMenu.nodeId = null;
    contextMenu.linkId = null;
    contextMenu.anchorIndex = -1;
    contextMenu.canvasPoint = null;
  }

  function openContextMenuAt(x, y, target = 'canvas', nodeId = null, canvasPoint = null, linkId = null, anchorIndex = -1) {
    contextMenu.open = true;
    contextMenu.x = x;
    contextMenu.y = y;
    contextMenu.target = target;
    contextMenu.nodeId = nodeId;
    contextMenu.linkId = linkId;
    contextMenu.anchorIndex = anchorIndex;
    contextMenu.canvasPoint = canvasPoint;
  }

  function openCanvasContextMenu(event, resolvePointerInCanvas, setStatus) {
    const point = resolvePointerInCanvas(event);
    if (!point) return;
    openContextMenuAt(event.clientX, event.clientY, 'canvas', null, point);
    if (setStatus) setStatus('已打开画布右键菜单。');
  }

  function onNodeContextMenu(node, event, opts = {}) {
    const { resolvePointerInCanvas, setStatus, clearBusSelection, syncBusDraftFromSelected, selectedIds, syncDraftFromSelected } = opts;
    if (!selectedIds.includes(node.id)) {
      selectedIds.value = [node.id];
      if (clearBusSelection) clearBusSelection({ sync: false });
      if (syncDraftFromSelected) syncDraftFromSelected();
    } else {
      if (clearBusSelection) clearBusSelection({ sync: false });
      if (syncBusDraftFromSelected) syncBusDraftFromSelected();
    }
    const point = resolvePointerInCanvas(event);
    openContextMenuAt(event.clientX, event.clientY, 'node', node.id, point);
    if (setStatus) setStatus(`已打开 ECU 右键菜单：${node.name}`);
  }

  function onLinkContextMenu(link, event, opts = {}) {
    const { resolvePointerInCanvas, setStatus } = opts;
    const point = resolvePointerInCanvas(event);
    openContextMenuAt(event.clientX, event.clientY, 'link', null, point, link.id, -1);
    if (setStatus) setStatus('已打开连线右键菜单。');
  }

  function onLinkAnchorContextMenu(link, anchorIndex, event, opts = {}) {
    const { resolvePointerInCanvas } = opts;
    const point = resolvePointerInCanvas(event);
    openContextMenuAt(event.clientX, event.clientY, 'anchor', null, point, link.id, anchorIndex);
  }

  return {
    contextMenu,
    closeContextMenu,
    openContextMenuAt,
    openCanvasContextMenu,
    onNodeContextMenu,
    onLinkContextMenu,
    onLinkAnchorContextMenu,
  };
}