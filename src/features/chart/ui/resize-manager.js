export function initResize(curveGroups, triggerRedraw) {
  function getWrappers() {
    return Array.from(document.querySelectorAll('.svg-resize-wrapper'));
  }

  function checkResize() {
    const wrappers = getWrappers();
    if (wrappers.length === 0) return;

    let changed = false;

    for (const wrapper of wrappers) {
      const groupIdx = Number(wrapper.getAttribute('data-group-idx'));
      if (!Number.isFinite(groupIdx)) continue;

      const group = curveGroups[groupIdx];
      if (!group) continue;

      const styleW = parseInt(wrapper.style.width, 10);
      const styleH = parseInt(wrapper.style.height, 10);
      if (!Number.isFinite(styleW) || !Number.isFinite(styleH)) continue;

      const currentWidth = Number(group?.displaySettings?.width) || 800;
      const currentHeight = Number(group?.displaySettings?.height) || 800;
      const safeWidth = Math.max(200, Math.min(2400, styleW));
      const safeHeight = Math.max(200, Math.min(2400, styleH));

      if (safeWidth !== currentWidth || safeHeight !== currentHeight) {
        group.displaySettings = {
          ...(group.displaySettings || {}),
          width: safeWidth,
          height: safeHeight,
        };
        changed = true;
      }
    }

    if (changed) {
      triggerRedraw();
    }
  }

  return setInterval(checkResize, 200);
}
