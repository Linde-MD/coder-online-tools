import { drawWithD3Engine } from '@/features/chart/engines/d3-chart-engine.js';

let activeRenderer = drawWithD3Engine;

export function setChartRenderer(renderer) {
  if (typeof renderer === 'function') {
    activeRenderer = renderer;
  }
}

export function getChartRenderer() {
  return activeRenderer;
}

export function drawChart(options) {
  return activeRenderer(options);
}
