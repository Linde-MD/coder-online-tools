export function bindChartActionButtons(options) {
  const { onAddCurveGroup, onReRender } = options;
  const addGroupButton = document.getElementById('btn-add-curve-group');
  const rerenderButton = document.getElementById('btn-re-render');

  if (addGroupButton) {
    addGroupButton.onclick = onAddCurveGroup;
  }

  if (rerenderButton) {
    rerenderButton.addEventListener('click', onReRender);
  }

  return {
    dispose() {
      if (addGroupButton) {
        addGroupButton.onclick = null;
      }
      if (rerenderButton) {
        rerenderButton.removeEventListener('click', onReRender);
      }
    },
  };
}
