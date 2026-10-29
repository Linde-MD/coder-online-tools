import { describe, expect, it } from 'vitest';
import { fitEditorWindow, getEditorDockTarget, isEditorDockPoint, resizeEditorWindow } from '../../../src/features/can-arch/services/editor-window-geometry.js';

describe('complete editor window geometry', () => {
  it('keeps floating window size and position within the viewport', () => {
    expect(fitEditorWindow({ x: -100, y: 1200, width: 640, height: 600 }, { width: 1280, height: 900 }))
      .toEqual({ x: 8, y: 292, width: 640, height: 600 });
  });

  it('limits oversized windows when the viewport becomes smaller', () => {
    expect(fitEditorWindow({ x: 900, y: 700, width: 1000, height: 900 }, { width: 390, height: 844 }))
      .toEqual({ x: 8, y: 8, width: 374, height: 828 });
  });

  it('enforces useful minimum dimensions without overflowing narrow screens', () => {
    expect(fitEditorWindow({ x: 0, y: 0, width: 10, height: 10 }, { width: 1280, height: 900 }))
      .toEqual({ x: 8, y: 8, width: 320, height: 240 });
    expect(fitEditorWindow({ x: 0, y: 0, width: 320, height: 240 }, { width: 200, height: 150 }))
      .toEqual({ x: 8, y: 8, width: 184, height: 134 });
  });

  it('handles a temporarily zero-sized viewport', () => {
    expect(fitEditorWindow({ x: 10, y: 10, width: 640, height: 600 }, { width: 0, height: 0 }))
      .toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });

  it('derives the right dock area from actual workspace bounds', () => {
    expect(getEditorDockTarget({ left: 40, top: 200, width: 1200, height: 600 }, 300))
      .toEqual({ left: 940, top: 200, width: 300, height: 600 });
    expect(getEditorDockTarget({ left: 10, top: 100, width: 200, height: 500 }, 300))
      .toEqual({ left: 10, top: 100, width: 200, height: 500 });
  });

  it('resizes from the bottom right without moving the top-left corner', () => {
    expect(resizeEditorWindow({ x: 600, y: 200, width: 400, height: 400 }, { width: 500, height: 500 }, { width: 1280, height: 900 }))
      .toEqual({ x: 600, y: 200, width: 672, height: 692 });
  });

  it('only docks while the pointer is over the right workspace region', () => {
    const target = { left: 940, top: 200, width: 300, height: 600 };
    expect(isEditorDockPoint({ x: 1000, y: 250 }, target)).toBe(true);
    expect(isEditorDockPoint({ x: 940, y: 200 }, target)).toBe(true);
    expect(isEditorDockPoint({ x: 1240, y: 800 }, target)).toBe(true);
    expect(isEditorDockPoint({ x: 939, y: 250 }, target)).toBe(false);
    expect(isEditorDockPoint({ x: 1000, y: 199 }, target)).toBe(false);
    expect(isEditorDockPoint({ x: 1000, y: 801 }, target)).toBe(false);
    expect(isEditorDockPoint({ x: 0, y: 0 }, { left: 0, top: 0, width: 0, height: 0 })).toBe(false);
  });
});