import { reactive, onBeforeUnmount } from 'vue';

export function useFloatingPanel({
  initialX = 10,
  initialY = 10,
  initialWidth = 280,
  initialHeight = 220,
  initialCollapsed = false,
  minWidth = 180,
  minHeight = 140,
  boundaryRef = null,
} = {}) {
  const state = reactive({
    x: initialX,
    y: initialY,
    width: initialWidth,
    height: initialHeight,
    collapsed: initialCollapsed,
  });

  const drag = {
    active: false,
    startX: 0,
    startY: 0,
    startLeft: 0,
    startTop: 0,
  };

  const resize = {
    active: false,
    startX: 0,
    startY: 0,
    startWidth: 0,
    startHeight: 0,
    direction: '',
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function getBounds() {
    const el = boundaryRef?.value;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
  }

  function cleanupDragListeners() {
    window.removeEventListener('pointermove', onDragMove);
    window.removeEventListener('pointerup', onDragEnd);
    window.removeEventListener('pointercancel', onDragEnd);
  }

  function cleanupResizeListeners() {
    window.removeEventListener('pointermove', onResizeMove);
    window.removeEventListener('pointerup', onResizeEnd);
    window.removeEventListener('pointercancel', onResizeEnd);
  }

  function onDragStart(event) {
    if (event.button !== 0) return;
    drag.active = true;
    drag.startX = event.clientX;
    drag.startY = event.clientY;
    drag.startLeft = state.x;
    drag.startTop = state.y;
    cleanupDragListeners();
    window.addEventListener('pointermove', onDragMove);
    window.addEventListener('pointerup', onDragEnd);
    window.addEventListener('pointercancel', onDragEnd);
  }

  function onDragMove(event) {
    if (!drag.active) return;
    const bounds = getBounds();
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    let newX = drag.startLeft + dx;
    let newY = drag.startTop + dy;
    if (bounds) {
      const maxX = bounds.width - state.width;
      const maxY = bounds.height - 40;
      newX = clamp(newX, 0, Math.max(0, maxX));
      newY = clamp(newY, 0, Math.max(0, maxY));
    }
    state.x = newX;
    state.y = newY;
  }

  function onDragEnd() {
    drag.active = false;
    cleanupDragListeners();
  }

  function onResizeStart(event, direction) {
    if (event.button !== 0) return;
    resize.active = true;
    resize.startX = event.clientX;
    resize.startY = event.clientY;
    resize.startWidth = state.width;
    resize.startHeight = state.height;
    resize.direction = direction;
    cleanupResizeListeners();
    window.addEventListener('pointermove', onResizeMove);
    window.addEventListener('pointerup', onResizeEnd);
    window.addEventListener('pointer.cancel', onResizeEnd);
  }

  function onResizeMove(event) {
    if (!resize.active) return;
    const dx = event.clientX - resize.startX;
    const dy = event.clientY - resize.startY;
    const bounds = getBounds();

    if (resize.direction.includes('e')) {
      let newWidth = resize.startWidth + dx;
      if (bounds) {
        const maxWidth = bounds.width - state.x;
        newWidth = Math.min(newWidth, maxWidth);
      }
      state.width = clamp(newWidth, minWidth, 4000);
    }
    if (resize.direction.includes('s')) {
      let newHeight = resize.startHeight + dy;
      if (bounds) {
        const maxHeight = bounds.height - state.y;
        newHeight = Math.min(newHeight, maxHeight);
      }
      state.height = clamp(newHeight, minHeight, 4000);
    }
  }

  function onResizeEnd() {
    resize.active = false;
    cleanupResizeListeners();
  }

  function toggleCollapse() {
    state.collapsed = !state.collapsed;
  }

  function setPosition(x, y) {
    state.x = x;
    state.y = y;
  }

  function setSize(width, height) {
    state.width = Math.max(minWidth, width);
    state.height = Math.max(minHeight, height);
  }

  function reset() {
    state.x = initialX;
    state.y = initialY;
    state.width = initialWidth;
    state.height = initialHeight;
    state.collapsed = initialCollapsed;
  }

  onBeforeUnmount(() => {
    cleanupDragListeners();
    cleanupResizeListeners();
    drag.active = false;
    resize.active = false;
  });

  const panelStyle = () => ({
    left: `${state.x}px`,
    top: `${state.y}px`,
    width: state.collapsed ? 'auto' : `${state.width}px`,
    height: state.collapsed ? 'auto' : `${state.height}px`,
  });

  return {
    state,
    panelStyle,
    onDragStart,
    onResizeStart,
    toggleCollapse,
    setPosition,
    setSize,
    reset,
  };
}