export function fitEditorWindow(rect, viewport) {
  const width = Math.max(0, viewport.width);
  const height = Math.max(0, viewport.height);
  const margin = Math.min(8, width / 2, height / 2);
  const maxWidth = Math.max(0, width - margin * 2);
  const maxHeight = Math.max(0, height - margin * 2);
  const windowWidth = Math.min(maxWidth, Math.max(Math.min(320, maxWidth), rect.width));
  const windowHeight = Math.min(maxHeight, Math.max(Math.min(240, maxHeight), rect.height));
  return {
    x: Math.max(margin, Math.min(rect.x, width - windowWidth - margin)),
    y: Math.max(margin, Math.min(rect.y, height - windowHeight - margin)),
    width: windowWidth,
    height: windowHeight,
  };
}

export function getEditorDockTarget(bounds, panelWidth) {
  const width = Math.max(0, Math.min(panelWidth, bounds.width));
  return {
    left: bounds.left + bounds.width - width,
    top: bounds.top,
    width,
    height: Math.max(0, bounds.height),
  };
}

export function resizeEditorWindow(rect, delta, viewport) {
  return fitEditorWindow({
    ...rect,
    width: Math.min(rect.width + delta.width, viewport.width - rect.x - 8),
    height: Math.min(rect.height + delta.height, viewport.height - rect.y - 8),
  }, viewport);
}

export function isEditorDockPoint(point, target) {
  return target.width > 0 && target.height > 0
    && point.x >= target.left && point.x <= target.left + target.width
    && point.y >= target.top && point.y <= target.top + target.height;
}