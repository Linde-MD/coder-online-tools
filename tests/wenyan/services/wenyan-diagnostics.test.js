import { describe, expect, it, vi } from 'vitest';
import { analyzeWenyanSource, createWenyanErrorMarker } from '../../../src/features/wenyan/services/wenyan-diagnostics.js';

describe('wenyan diagnostics', () => {
  it('maps unknown tokens to editor marker positions', () => {
    const source = '吾有一數。\n未知語法。';
    const core = {
      wy2tokens: vi.fn(() => [['data', '未知語法。', 1]]),
    };

    expect(analyzeWenyanSource(core, source)).toEqual([
      {
        severity: 8,
        message: '无法识别的文言语法：未知語法。',
        startLineNumber: 2,
        endLineNumber: 2,
        startColumn: 1,
        endColumn: 6,
      },
    ]);
  });

  it('returns no diagnostics for empty and valid source', () => {
    const core = { wy2tokens: vi.fn(() => [['decl', 'uninit', 1]]) };

    expect(analyzeWenyanSource(core, '  \n')).toEqual([]);
    expect(analyzeWenyanSource(core, '吾有一數。')).toEqual([]);
    expect(core.wy2tokens).toHaveBeenCalledTimes(1);
  });

  it('reports compiler failures across the source line', () => {
    expect(createWenyanErrorMarker('编译失败', '吾有一數。')).toEqual({
      severity: 8,
      message: '编译失败',
      startLineNumber: 1,
      endLineNumber: 1,
      startColumn: 1,
      endColumn: 6,
    });
  });

  it('surfaces an unavailable or invalid tokenizer instead of hiding it', () => {
    expect(() => analyzeWenyanSource(null, '吾有一數。')).toThrow('文言语法检查器尚未就绪。');
    expect(() => analyzeWenyanSource({ wy2tokens: () => null }, '吾有一數。'))
      .toThrow('文言语法检查器返回了无效结果。');
  });
});
