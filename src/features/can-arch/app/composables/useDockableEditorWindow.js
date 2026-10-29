import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { fitEditorWindow, getEditorDockTarget, isEditorDockPoint, resizeEditorWindow } from '../../services/editor-window-geometry.js';

export function useDockableEditorWindow({ frame, workspace, dockWidth, floating, setFloating }) {
  const rect = ref({ x: 80, y: 80, width: 640, height: 600 });
  const dockPreview = ref(null);
  const interacting = ref(false);
  const portalTarget = ref('body');
  let action = null;
  let resizeObserver = null;
  let featureObserver = null;

  watch([floating, portalTarget], () => {
    const active = document.activeElement;
    const restoreFocus = active && frame.value?.contains?.(active);
    const positions = [...(frame.value?.querySelectorAll?.('textarea') || [])]
      .map((node) => ({ node, top: node.scrollTop, left: node.scrollLeft }));
    nextTick(() => {
      if (restoreFocus && active.isConnected) active.focus({ preventScroll: true });
      for (const { node, top, left } of positions) {
        if (!node.isConnected) continue;
        node.scrollTop = top;
        node.scrollLeft = left;
      }
    });
  });

  function constrain(value) {
    const top = Math.max(0, workspace.value?.closest('.feature-panel')?.getBoundingClientRect().top || 0);
    const fitted = fitEditorWindow({ ...value, y: value.y - top }, {
      width: window.innerWidth, height: Math.max(0, window.innerHeight - top),
    });
    return { ...fitted, y: fitted.y + top };
  }

  function initialRect() {
    const bounds = frame.value.getBoundingClientRect();
    return constrain({ x: bounds.left, y: bounds.top, width: 640, height: Math.max(bounds.height, 560) });
  }

  function stop() {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onEnd);
    window.removeEventListener('pointercancel', cancel);
    window.removeEventListener('blur', cancel);
    action = null;
    interacting.value = false;
    dockPreview.value = null;
  }

  function cancel() {
    stop();
  }

  function onMove(event) {
    if (!action || event.pointerId !== action.pointerId) return;
    const dx = event.clientX - action.x;
    const dy = event.clientY - action.y;
    if (action.kind === 'resize') {
      rect.value = constrain(resizeEditorWindow(action.rect, { width: dx, height: dy }, {
        width: window.innerWidth, height: window.innerHeight,
      }));
      return;
    }
    if (!action.detached) {
      if (Math.hypot(dx, dy) < 6) return;
      const bounds = frame.value.getBoundingClientRect();
      const next = initialRect();
      rect.value = constrain({ ...next, x: event.clientX - Math.min(action.x - bounds.left, next.width - 44), y: event.clientY - (action.y - bounds.top) });
      setFloating(true);
      action = { ...action, detached: true, x: event.clientX, y: event.clientY, rect: { ...rect.value } };
    } else {
      rect.value = constrain({ ...action.rect, x: action.rect.x + dx, y: action.rect.y + dy });
    }
    const bounds = workspace.value?.getBoundingClientRect();
    if (!bounds) return;
    const point = { x: event.clientX, y: event.clientY };
    dockPreview.value = isEditorDockPoint(point, getEditorDockTarget(bounds, Math.min(80, dockWidth.value)))
      ? getEditorDockTarget(bounds, dockWidth.value) : null;
  }

  function onEnd(event) {
    if (!action || event.pointerId !== action.pointerId) return;
    const shouldDock = action.kind === 'drag' && !!dockPreview.value;
    stop();
    if (shouldDock) setFloating(false);
  }

  function start(event, kind) {
    if (event.button !== 0 || (kind === 'drag' && event.target.closest('button, input, textarea, select'))) return;
    stop();
    if (floating.value) {
      const bounds = frame.value.getBoundingClientRect();
      rect.value = constrain({ x: bounds.left, y: bounds.top, width: bounds.width, height: bounds.height });
    }
    event.preventDefault();
    event.stopPropagation();
    action = { kind, pointerId: event.pointerId, x: event.clientX, y: event.clientY, rect: { ...rect.value }, detached: floating.value };
    interacting.value = true;
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('blur', cancel);
  }

  function toggle() {
    stop();
    if (!floating.value) rect.value = initialRect();
    setFloating(!floating.value);
  }

  function handleArrow(event, resize = false) {
    if (!floating.value || (event.target !== event.currentTarget && !resize)) return;
    const vectors = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const vector = vectors[event.key];
    if (!vector) return;
    event.preventDefault();
    event.stopPropagation();
    const step = event.shiftKey ? 40 : 16;
    rect.value = resize
      ? constrain(resizeEditorWindow(rect.value, { width: vector[0] * step, height: vector[1] * step }, {
        width: window.innerWidth, height: window.innerHeight,
      }))
      : constrain({ ...rect.value, x: rect.value.x + vector[0] * step, y: rect.value.y + vector[1] * step });
  }

  function onViewportChange() {
    stop();
    const feature = workspace.value?.closest('.feature-panel');
    portalTarget.value = document.fullscreenElement
      || (feature?.classList?.contains('is-fullscreen') ? feature : document.body) || 'body';
    if (floating.value) rect.value = constrain(rect.value);
  }

  onMounted(() => {
    onViewportChange();
    window.addEventListener('resize', onViewportChange);
    document.addEventListener('fullscreenchange', onViewportChange);
    if (typeof ResizeObserver !== 'undefined' && workspace.value) {
      resizeObserver = new ResizeObserver(onViewportChange);
      resizeObserver.observe(workspace.value);
    }
    const feature = workspace.value?.closest('.feature-panel');
    if (typeof MutationObserver !== 'undefined' && feature) {
      featureObserver = new MutationObserver(onViewportChange);
      featureObserver.observe(feature, { attributes: true, attributeFilter: ['class', 'style'] });
    }
  });
  onBeforeUnmount(() => {
    stop();
    resizeObserver?.disconnect();
    featureObserver?.disconnect();
    window.removeEventListener('resize', onViewportChange);
    document.removeEventListener('fullscreenchange', onViewportChange);
  });

  return {
    dockPreview, interacting, portalTarget, toggle,
    startDrag: (event) => start(event, 'drag'),
    startResize: (event) => start(event, 'resize'),
    moveWithKeyboard: (event) => handleArrow(event),
    resizeWithKeyboard: (event) => handleArrow(event, true),
    windowStyle: computed(() => floating.value ? {
      left: `${rect.value.x}px`, top: `${rect.value.y}px`, width: `${rect.value.width}px`, height: `${rect.value.height}px`,
      '--editor-window-min-top': `${Math.max(0, workspace.value?.closest('.feature-panel')?.getBoundingClientRect().top || 0) + 8}px`,
    } : {}),
    previewStyle: computed(() => dockPreview.value ? {
      left: `${dockPreview.value.left}px`, top: `${dockPreview.value.top}px`,
      width: `${dockPreview.value.width}px`, height: `${dockPreview.value.height}px`,
    } : {}),
  };
}