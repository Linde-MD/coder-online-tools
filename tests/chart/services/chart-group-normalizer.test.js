import { describe, expect, it } from 'vitest';
import { normalizeChartGroups } from '@/features/chart/services/chart-group-normalizer.js';

const chartCfg = {
  xVariableName: 'RPM',
  xUnit: 'r/min',
  yVariableName: 'Torque',
  yUnit: 'Nm',
};

describe('normalizeChartGroups', () => {
  it('normalizes points/labels/stats from pointsStr and keeps source index', () => {
    const groups = normalizeChartGroups([
      {
        title: '发动机曲线',
        xName: 'X',
        yName: 'Y',
        sourceGroupIdx: 7,
        curves: [
          {
            text: 'Curve A',
            color: '#ff0000',
            pointsStr: '(0,0),(10,100),(20,50)',
          },
        ],
      },
    ], chartCfg, ['#00aa00']);

    expect(groups).toHaveLength(1);
    expect(groups[0].sourceGroupIdx).toBe(7);
    expect(groups[0].curves).toHaveLength(1);
    expect(groups[0].curves[0].points.length).toBe(3);
    expect(groups[0].curves[0].sortedPoints[0]).toEqual({ x: 0, y: 0 });
    expect(groups[0].curves[0].sortedPoints[2]).toEqual({ x: 20, y: 50 });
    expect(groups[0].curves[0].stats).toEqual({ min: 0, max: 100, avg: 50 });
    expect(groups[0].curves[0].labelPoint).toEqual({ x: 10, y: 100 });
  });

  it('applies default names/colors and filters empty curves', () => {
    const groups = normalizeChartGroups([
      {
        curves: [
          {
            pointsStr: '1,2,3,4',
          },
          {
            pointsStr: '',
          },
        ],
      },
    ], chartCfg, ['#123456']);

    expect(groups).toHaveLength(1);
    expect(groups[0].title).toBe('曲线组 1');
    expect(groups[0].xName).toBe('RPM');
    expect(groups[0].yName).toBe('Torque');
    expect(groups[0].curves).toHaveLength(1);
    expect(groups[0].curves[0].color).toBe('#123456');
    expect(groups[0].curves[0].text).toBe('Curve 1');
  });
});
