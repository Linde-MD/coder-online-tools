export function initFeatureMenu() {
  const chartBtn = document.getElementById('btn-feature-chart');
  const j1939Btn = document.getElementById('btn-feature-j1939');
  const chartPanel = document.getElementById('feature-chart');
  const j1939Panel = document.getElementById('feature-j1939');

  if (!chartBtn || !j1939Btn || !chartPanel || !j1939Panel) return;

  function setActive(mode) {
    const showChart = mode === 'chart';
    chartBtn.classList.toggle('active', showChart);
    j1939Btn.classList.toggle('active', !showChart);
    chartBtn.classList.toggle('btn-primary', showChart);
    chartBtn.classList.toggle('btn-outline-primary', !showChart);
    j1939Btn.classList.toggle('btn-primary', !showChart);
    j1939Btn.classList.toggle('btn-outline-primary', showChart);
    chartBtn.setAttribute('aria-pressed', showChart ? 'true' : 'false');
    j1939Btn.setAttribute('aria-pressed', showChart ? 'false' : 'true');
    chartPanel.classList.toggle('active', showChart);
    j1939Panel.classList.toggle('active', !showChart);
  }

  chartBtn.addEventListener('click', () => setActive('chart'));
  j1939Btn.addEventListener('click', () => setActive('j1939'));

  setActive('chart');
}
