import { describe, expect, it } from 'vitest';
import { normalizeDisplaySettings } from '@/features/chart/services/chart-display-settings-modal.js';

describe('normalizeDisplaySettings', () => {
  it('keeps explicit values and normalizes number fields', () => {
    const result = normalizeDisplaySettings({
      width: '960',
      height: '540',
      showGrid: false,
      showPoints: true,
      chartBackgroundColor: '#101010',
      axisColor: '#202020',
      tickColor: '#303030',
      gridColor: '#404040',
    });

    expect(result).toEqual({
      width: 960,
      height: 540,
      showGrid: false,
      showPoints: true,
      chartBackgroundColor: '#101010',
      axisColor: '#202020',
      tickColor: '#303030',
      gridColor: '#404040',
    });
  });

  it('falls back to safe defaults when values are missing or invalid', () => {
    const result = normalizeDisplaySettings({
      width: 'NaN',
      height: undefined,
      showGrid: 'x',
      showPoints: null,
    });

    expect(Number.isFinite(result.width)).toBe(true);
    expect(Number.isFinite(result.height)).toBe(true);
    expect(typeof result.showGrid).toBe('boolean');
    expect(typeof result.showPoints).toBe('boolean');
    expect(result.chartBackgroundColor).toBeTruthy();
    expect(result.axisColor).toBeTruthy();
    expect(result.tickColor).toBeTruthy();
    expect(result.gridColor).toBeTruthy();
  });
});
