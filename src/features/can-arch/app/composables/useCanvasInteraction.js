import { ref, computed } from 'vue';

export function useCanvasInteraction({
  canvasRef,
  sceneSize,
  onZoomChange,
  onResize,
  isFullscreen,
  onFullscreenToggle,
}) {
  const canvasZoom = ref(1);
  const panState = ref(null);
  const isCanvasPanning = ref(false);
  const selectionRect = ref(null);

  const canvasHeight = ref(620);
  const nonFullscreenCanvasHeight = ref(620);

  const sceneViewportSizeComputed = computed(() => {
    const w = Math.max(sceneSize.value?.width || 2000, 2000);
    const h = Math.max(sceneSize.value?.height || 1500, 1500);
    return { width: w, height: h };
  });

  function onCanvasWheel(event) {
    event.preventDefault();
    const delta = event.deltaY;
    const zoomSensitivity = 0.0015;
    const newZoom = Math.max(0.35, Math.min(2.5, canvasZoom.value - delta * zoomSensitivity));
    canvasZoom.value = newZoom;
    onZoomChange?.(newZoom);
  }

  function resolvePointerInCanvas(event) {
    const canvasElement = canvasRef.value;
    if (!canvasElement) return null;
    const rect = canvasElement.getBoundingClientRect();
    const x = (event.clientX - rect.left) / canvasZoom.value;
    const y = (event.clientY - rect.top) / canvasZoom.value;
    return {
      x: Math.round(x),
      y: Math.round(y),
    };
  }

  function onCanvasPointerDown(event) {
    if (event.target === event.currentTarget) {
      event.preventDefault();
      const point = resolvePointerInCanvas(event);
      if (!point) return;
      panState.value = {
        startX: event.clientX,
        startY: event.clientY,
        startCanvasX: point.x,
        startCanvasY: point.y,
        pointerId: event.pointerId,
      };
      isCanvasPanning.value = true;
      selectionRect.value = null;
      window.addEventListener('pointermove', onCanvasPanMove);
      window.addEventListener('pointerup', onCanvasPanEnd);
      document.addEventListener('pointermove', onCanvasPanMove);
      document.addEventListener('pointerup', onCanvasPanEnd);
      event.currentTarget?.setPointerCapture?.(event.pointerId);
    }
  }

  function onCanvasPointerUp(event) {
    if (panState.value && panState.value.pointerId === event.pointerId) {
      onCanvasPanEnd(event);
    }
  }

  function onCanvasLostPointerCapture(event) {
    if (panState.value && panState.value.pointerId === event.pointerId) {
      onCanvasPanEnd(event);
    }
  }

  function onCanvasPointerCancel(event) {
    if (panState.value && panState.value.pointerId === event.pointerId) {
      onCanvasPanEnd(event);
    }
  }

  function onCanvasPanMove(event) {
    if (!panState.value) return;
    const dx = event.clientX - panState.value.startX;
    const dy = event.clientY - panState.value.startY;
    const vp = sceneViewportSizeComputed.value;
    sceneSize.value = {
      width: Math.max(vp.width, panState.value.startCanvasX * 2 + Math.abs(dx) + 400),
      height: Math.max(vp.height, panState.value.startCanvasY * 2 + Math.abs(dy) + 400),
    };
  }

  function onCanvasPanEnd(event) {
    window.removeEventListener('pointermove', onCanvasPanMove);
    window.removeEventListener('pointerup', onCanvasPanEnd);
    document.removeEventListener('pointermove', onCanvasPanMove);
    document.removeEventListener('pointerup', onCanvasPanEnd);
    isCanvasPanning.value = false;
    panState.value = null;
  }

  function syncFullscreenCanvasHeight() {
    if (!isFullscreen.value) return;
    const canvasElement = canvasRef.value;
    if (!canvasElement) return;
    const bounds = canvasElement.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    const available = Math.floor(viewportHeight - bounds.top - 10);
    canvasHeight.value = Math.max(320, available);
    onResize?.(canvasHeight.value);
  }

  function onWindowResize() {
    if (!isFullscreen.value) return;
    syncFullscreenCanvasHeight();
  }

  function toggleFullscreen() {
    onFullscreenToggle?.();
  }

  function onCanvasResizePointerDown(event) {
    event.preventDefault();
    event.stopPropagation();
    const startY = event.clientY;
    const startHeight = canvasHeight.value;
    const pointerId = event.pointerId;
    const target = event.currentTarget;

    function onMove(e) {
      if (e.pointerId !== pointerId) return;
      const dy = e.clientY - startY;
      const newHeight = Math.max(320, startHeight + dy);
      canvasHeight.value = newHeight;
    }

    function onUp(e) {
      if (e.pointerId !== pointerId) return;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      target?.releasePointerCapture?.(pointerId);
    }

    target?.setPointerCapture?.(pointerId);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }

  return {
    canvasZoom,
    canvasHeight,
    nonFullscreenCanvasHeight,
    isCanvasPanning,
    selectionRect,
    resolvePointerInCanvas,
    onCanvasWheel,
    onCanvasPointerDown,
    onCanvasPointerUp,
    onCanvasLostPointerCapture,
    onCanvasPointerCancel,
    onWindowResize,
    toggleFullscreen,
    syncFullscreenCanvasHeight,
    onCanvasResizePointerDown,
  };
}