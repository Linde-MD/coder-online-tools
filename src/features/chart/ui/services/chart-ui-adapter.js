import { createApp } from 'vue';

function resolveFn(fn, fallback) {
  return typeof fn === 'function' ? fn : fallback;
}

export function createChartUiAdapter(overrides = {}) {
  const getCurveListHost = resolveFn(overrides.getCurveListHost, () => document.getElementById('curve-list'));
  const showMessage = resolveFn(overrides.showMessage, (message) => window.alert(message));

  function mountCurveList({ component, props, existingApp }) {
    const host = getCurveListHost();
    if (!host) return existingApp || null;

    if (existingApp) {
      existingApp.unmount();
    }

    host.innerHTML = '';
    const app = createApp(component, props || {});
    app.mount(host);
    return app;
  }

  return {
    getCurveListHost,
    showMessage,
    mountCurveList,
  };
}
