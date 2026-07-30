export function createSettingsPanelController() {
  function handleDocumentClick(event) {
    const togglePanelBtn = event.target.closest('.settings-collapse-btn');
    if (!togglePanelBtn) return;

    const panel = togglePanelBtn.closest('.settings-panel');
    if (!panel) return;

    panel.classList.toggle('settings-panel-collapsed');
    const expanded = !panel.classList.contains('settings-panel-collapsed');
    togglePanelBtn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  }

  document.addEventListener('click', handleDocumentClick);

  return {
    dispose() {
      document.removeEventListener('click', handleDocumentClick);
    },
  };
}
