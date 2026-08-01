import { ref } from 'vue';

export function useCanvasResize({
  isFullscreen,
  canvasHeight,
  editorPanelHeight,
  ecuMessageEditor,
  ecuMessageEditorRef,
  setStatus,
}) {
  let canvasResizeState = null;

  function onCanvasResizePointerDown(event) {
    if (isFullscreen.value) return;
    if (event.button !== 0) return;

    const currentHeight = ecuMessageEditor.active
      ? Number(editorPanelHeight.value) || 620
      : Number(canvasHeight.value) || 620;

    canvasResizeState = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startHeight: currentHeight,
      pointerTarget: event.currentTarget,
    };

    event.currentTarget?.setPointerCapture?.(event.pointerId);
    window.addEventListener('pointermove', onCanvasResizePointerMove);
    window.addEventListener('pointerup', onCanvasResizePointerUp);
    document.addEventListener('pointermove', onCanvasResizePointerMove);
    document.addEventListener('pointerup', onCanvasResizePointerUp);
  }

  function onCanvasResizePointerMove(event) {
    if (!canvasResizeState || canvasResizeState.pointerId !== event.pointerId) return;
    const dy = event.clientY - canvasResizeState.startY;
    const newHeight = Math.max(320, Math.round(canvasResizeState.startHeight + dy));
    canvasHeight.value = newHeight;
    if (ecuMessageEditor.active) {
      editorPanelHeight.value = newHeight;
    }
  }

  function onCanvasResizePointerUp(event) {
    if (!canvasResizeState) return;
    if (event && canvasResizeState.pointerId !== event.pointerId) return;
    canvasResizeState.pointerTarget?.releasePointerCapture?.(canvasResizeState.pointerId);
    canvasResizeState = null;
    window.removeEventListener('pointermove', onCanvasResizePointerMove);
    window.removeEventListener('pointerup', onCanvasResizePointerUp);
    document.removeEventListener('pointermove', onCanvasResizePointerMove);
    document.removeEventListener('pointerup', onCanvasResizePointerUp);
  }

  return {
    onCanvasResizePointerDown,
    onCanvasResizePointerMove,
    onCanvasResizePointerUp,
  };
}