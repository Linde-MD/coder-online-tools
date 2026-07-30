function escapeAttr(value) {
  return String(value || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function createCurveContextMenu(options) {
  const { curveGroups, onMoveCurveToGroup } = options;

  const menuRoot = document.createElement('div');
  menuRoot.className = 'curve-context-menu';
  menuRoot.style.display = 'none';
  document.body.appendChild(menuRoot);

  let contextMenuSource = null;

  function hideCurveContextMenu() {
    menuRoot.style.display = 'none';
    menuRoot.innerHTML = '';
    contextMenuSource = null;
  }

  function showCurveContextMenu(x, y, fromGroupIdx, fromCurveIdx) {
    contextMenuSource = { fromGroupIdx, fromCurveIdx };
    const targets = curveGroups
      .map((group, idx) => ({ idx, title: group.title || `曲线组 ${idx + 1}` }))
      .filter(item => item.idx !== fromGroupIdx);

    menuRoot.innerHTML = targets.length > 0
      ? targets.map(item => `
          <button type="button" class="curve-context-item" data-target-group-idx="${item.idx}">
            移入：${escapeAttr(item.title)}
          </button>
        `).join('')
      : '<div class="curve-context-empty">没有可移动的目标曲线组</div>';

    menuRoot.style.display = 'block';
    const rect = menuRoot.getBoundingClientRect();
    const left = Math.max(8, Math.min(x, window.innerWidth - rect.width - 8));
    const top = Math.max(8, Math.min(y, window.innerHeight - rect.height - 8));
    menuRoot.style.left = `${left}px`;
    menuRoot.style.top = `${top}px`;
  }

  function handleDocumentClick(event) {
    const contextItem = event.target.closest('.curve-context-item');
    if (contextItem) {
      if (!contextMenuSource) {
        hideCurveContextMenu();
        return;
      }

      const targetGroupIdx = Number(contextItem.getAttribute('data-target-group-idx'));
      const { fromGroupIdx, fromCurveIdx } = contextMenuSource;
      hideCurveContextMenu();

      if (!Number.isFinite(targetGroupIdx)) return;
      onMoveCurveToGroup(fromGroupIdx, fromCurveIdx, targetGroupIdx);
      return;
    }

    if (!menuRoot.contains(event.target)) {
      hideCurveContextMenu();
    }
  }

  function handleDocumentContextMenu(event) {
    if (!event.target.closest('.curve-item-card')) {
      hideCurveContextMenu();
    }
  }

  function handleDocumentKeydown(event) {
    if (event.key === 'Escape') {
      hideCurveContextMenu();
    }
  }

  document.addEventListener('click', handleDocumentClick);
  document.addEventListener('contextmenu', handleDocumentContextMenu);
  document.addEventListener('keydown', handleDocumentKeydown);
  window.addEventListener('resize', hideCurveContextMenu);
  document.addEventListener('scroll', hideCurveContextMenu, true);

  return {
    showCurveContextMenu,
    hideCurveContextMenu,
    dispose() {
      document.removeEventListener('click', handleDocumentClick);
      document.removeEventListener('contextmenu', handleDocumentContextMenu);
      document.removeEventListener('keydown', handleDocumentKeydown);
      window.removeEventListener('resize', hideCurveContextMenu);
      document.removeEventListener('scroll', hideCurveContextMenu, true);
      menuRoot.remove();
    },
  };
}
