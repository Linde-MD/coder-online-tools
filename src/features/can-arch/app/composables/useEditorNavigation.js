import { ref, nextTick, watch } from 'vue';

export function useEditorNavigation({
  isFullscreen,
  canvasHeight,
  editorPanelHeight,
  canvasRef,
  ecuMessageEditorRef,
  ecuMessageEditor,
  nodes,
  magneticHeader,
  isHeaderPeeking,
  setStatus,
  getCanvasBounds,
  syncFullscreenCanvasHeight,
}) {
  function openEcuMessageEditor(node) {
    if (!node?.id) return;
    ecuMessageEditor.ecuId = node.id;
    ecuMessageEditor.ecu = node;
    ecuMessageEditor.active = true;
    setStatus(`进入 ECU 报文编辑：${node.name}`);
    if (isFullscreen.value) {
      nextTick(() => {
        syncFullscreenCanvasHeight();
      });
    } else {
      const vh = window.innerHeight || document.documentElement.clientHeight || 900;
      const headerEl = document.querySelector('.can-arch-header');
      const headerH = headerEl ? headerEl.getBoundingClientRect().height : 0;
      const topOffset = headerH + 160;
      const available = Math.floor(vh - topOffset);
      const h = Math.max(480, Math.min(available, 900));
      canvasHeight.value = h;
      editorPanelHeight.value = h;
    }
  }

  function closeEcuMessageEditor() {
    const name = ecuMessageEditor.ecu?.name || 'ECU';
    ecuMessageEditor.active = false;
    ecuMessageEditor.ecuId = '';
    ecuMessageEditor.ecu = null;
    setStatus(`已返回 CAN 画布（${name} 报文编辑已关闭）。`);
    if (isFullscreen.value) {
      nextTick(() => {
        syncFullscreenCanvasHeight();
      });
    }
  }

  function switchEcuInEditor(targetEcuId) {
    const node = nodes.value.find((item) => item.id === targetEcuId);
    if (!node) return;
    ecuMessageEditor.ecuId = node.id;
    ecuMessageEditor.ecu = node;
    setStatus(`切换到 ECU 报文编辑：${node.name}`);
  }

  function toggleFullscreen() {
    if (!isFullscreen.value) {
      const nonFullscreenCanvasHeight = canvasHeight.value;
      isFullscreen.value = true;
      nextTick(() => {
        syncFullscreenCanvasHeight();
      });
      return;
    }
    isFullscreen.value = !isFullscreen.value;
  }

  return {
    openEcuMessageEditor,
    closeEcuMessageEditor,
    switchEcuInEditor,
    toggleFullscreen,
  };
}