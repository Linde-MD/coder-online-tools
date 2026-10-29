import { afterEach, describe, expect, it, vi } from 'vitest';
import { effectScope, ref } from 'vue';
import { useDockableEditorWindow } from '../../../src/features/can-arch/app/composables/useDockableEditorWindow.js';

const lifecycle = vi.hoisted(() => ({ mounted: [], cleanup: [] }));
vi.mock('vue', async (importOriginal) => ({
  ...await importOriginal(),
  onMounted: (callback) => lifecycle.mounted.push(callback),
  onBeforeUnmount: (callback) => lifecycle.cleanup.push(callback),
}));
const scopes = [];
afterEach(() => {
  lifecycle.cleanup.splice(0).forEach((callback) => callback());
  lifecycle.mounted.length = 0;
  scopes.splice(0).forEach((scope) => scope.stop());
  vi.unstubAllGlobals();
});

function setup({ initialFloating = false, featureTop = 0 } = {}) {
  const events = new EventTarget();
  const browser = {
    innerWidth: 1280, innerHeight: 900,
    addEventListener: vi.fn(events.addEventListener.bind(events)),
    removeEventListener: vi.fn(events.removeEventListener.bind(events)),
  };
  const documentEvents = new EventTarget();
  vi.stubGlobal('window', browser);
  vi.stubGlobal('document', documentEvents);
  let onWorkspaceResize;
  const observer = { observe: vi.fn(), disconnect: vi.fn() };
  vi.stubGlobal('ResizeObserver', vi.fn(function (callback) {
    onWorkspaceResize = callback;
    return observer;
  }));
  let onFeatureMutation;
  const featureObserver = { observe: vi.fn(), disconnect: vi.fn() };
  vi.stubGlobal('MutationObserver', vi.fn(function (callback) {
    onFeatureMutation = callback;
    return featureObserver;
  }));
  const featureBounds = { top: featureTop };
  const floating = ref(initialFloating);
  const scope = effectScope();
  scopes.push(scope);
  let panel;
  panel = scope.run(() => useDockableEditorWindow({
    floating, setFloating: (value) => { floating.value = value; }, dockWidth: ref(300),
    frame: ref({ getBoundingClientRect: () => floating.value && panel ? {
      left: parseFloat(panel.windowStyle.value.left), top: parseFloat(panel.windowStyle.value.top),
      width: parseFloat(panel.windowStyle.value.width), height: parseFloat(panel.windowStyle.value.height),
    } : { left: 940, top: 200, width: 300, height: 600 } }),
    workspace: ref({
      closest: () => ({ getBoundingClientRect: () => featureBounds }),
      getBoundingClientRect: () => ({ left: 40, top: 200, width: 1200, height: 600 }),
    }),
  }));
  lifecycle.mounted.splice(0).forEach((callback) => callback());
  const pointer = (clientX, clientY, pointerId = 1) => ({
    button: 0, pointerId, clientX, clientY,
    target: { closest: () => null }, preventDefault: vi.fn(), stopPropagation: vi.fn(),
  });
  function dispatch(type, clientX, clientY, pointerId = 1) {
    const event = new Event(type);
    Object.assign(event, { clientX, clientY, pointerId });
    events.dispatchEvent(event);
  }
  return {
    panel, floating, browser, pointer, dispatch, observer, featureObserver, featureBounds,
    onWorkspaceResize: () => onWorkspaceResize(), onFeatureMutation: () => onFeatureMutation(),
  };
}

describe('dockable complete editor lifecycle', () => {
  it('ignores a click but detaches after a real drag threshold', () => {
    const { panel, floating, pointer, dispatch } = setup();
    panel.startDrag(pointer(1000, 220));
    dispatch('pointermove', 1002, 221);
    expect(floating.value).toBe(false);
    dispatch('pointermove', 800, 240);
    expect(floating.value).toBe(true);
    dispatch('pointerup', 800, 240);
    expect(panel.interacting.value).toBe(false);
  });

  it('previews the actual right dock and docks only on release', () => {
    const { panel, floating, pointer, dispatch } = setup();
    panel.toggle();
    panel.startDrag(pointer(700, 220));
    dispatch('pointermove', 1200, 250);
    expect(panel.dockPreview.value).toEqual({ left: 940, top: 200, width: 300, height: 600 });
    expect(floating.value).toBe(true);
    dispatch('pointerup', 1200, 250);
    expect(floating.value).toBe(false);
    expect(panel.dockPreview.value).toBeNull();
  });

  it('does not dock on pointer cancellation or accept another pointer', () => {
    const { panel, floating, pointer, dispatch } = setup();
    panel.toggle();
    panel.startDrag(pointer(700, 220));
    dispatch('pointermove', 1200, 250, 2);
    expect(panel.dockPreview.value).toBeNull();
    dispatch('pointermove', 1200, 250);
    dispatch('pointercancel', 1200, 250);
    expect(floating.value).toBe(true);
    expect(panel.interacting.value).toBe(false);
    expect(panel.dockPreview.value).toBeNull();
  });

  it('resizes without moving its top-left and clamps to the available viewport', () => {
    const { panel, pointer, dispatch } = setup();
    panel.toggle();
    const original = { ...panel.windowStyle.value };
    panel.startResize(pointer(1000, 700));
    dispatch('pointermove', 1800, 1500);
    expect(panel.windowStyle.value.left).toBe(original.left);
    expect(panel.windowStyle.value.top).toBe(original.top);
    expect(parseFloat(panel.windowStyle.value.width) + parseFloat(original.left)).toBeLessThanOrEqual(1272);
    expect(parseFloat(panel.windowStyle.value.height) + parseFloat(original.top)).toBeLessThanOrEqual(892);
  });

  it('reclamps after a viewport resize and stops active interactions', () => {
    const { panel, browser, pointer, dispatch } = setup();
    panel.toggle();
    panel.startDrag(pointer(700, 220));
    browser.innerWidth = 390;
    browser.innerHeight = 844;
    dispatch('resize', 0, 0);
    expect(panel.interacting.value).toBe(false);
    expect(parseFloat(panel.windowStyle.value.width)).toBeLessThanOrEqual(374);
    expect(parseFloat(panel.windowStyle.value.left) + parseFloat(panel.windowStyle.value.width)).toBeLessThanOrEqual(382);
  });

  it('constrains an initially floating instance before the first resize', () => {
    const { panel, pointer, dispatch } = setup({ initialFloating: true, featureTop: 120 });
    const original = { ...panel.windowStyle.value };
    expect(original.top).toBe('128px');
    panel.startResize(pointer(700, 700));
    dispatch('pointermove', 740, 740);
    expect(panel.windowStyle.value.top).toBe(original.top);
    expect(panel.windowStyle.value.left).toBe(original.left);
  });

  it('reclamps after CSS fullscreen changes the workspace without a window resize', () => {
    const { panel, featureBounds, onWorkspaceResize, observer } = setup({ initialFloating: true, featureTop: 120 });
    featureBounds.top = 0;
    onWorkspaceResize();
    const target = {};
    for (let index = 0; index < 6; index += 1) {
      panel.moveWithKeyboard({ key: 'ArrowUp', shiftKey: true, target, currentTarget: target, preventDefault: vi.fn(), stopPropagation: vi.fn() });
    }
    expect(panel.windowStyle.value.top).toBe('8px');
    featureBounds.top = 120;
    onWorkspaceResize();
    expect(panel.windowStyle.value.top).toBe('128px');
    expect(observer.observe).toHaveBeenCalledTimes(1);
  });

  it('releases pointer, viewport and fullscreen listeners on unmount', () => {
    const { panel, floating, browser, pointer, dispatch, observer, featureObserver } = setup();
    panel.toggle();
    panel.startDrag(pointer(700, 220));
    lifecycle.cleanup.splice(0).forEach((callback) => callback());
    const position = { ...panel.windowStyle.value };
    dispatch('pointermove', 1200, 250);
    dispatch('pointerup', 1200, 250);
    expect(panel.windowStyle.value).toEqual(position);
    expect(floating.value).toBe(true);
    expect(browser.removeEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
    expect(observer.disconnect).toHaveBeenCalledTimes(1);
    expect(featureObserver.disconnect).toHaveBeenCalledTimes(1);
    expect(panel.interacting.value).toBe(false);
  });

  it('handles a feature fullscreen class change without a workspace size change', () => {
    const { panel, featureBounds, onFeatureMutation, featureObserver } = setup({ initialFloating: true, featureTop: 0 });
    const target = {};
    for (let index = 0; index < 6; index += 1) {
      panel.moveWithKeyboard({ key: 'ArrowUp', shiftKey: true, target, currentTarget: target, preventDefault: vi.fn(), stopPropagation: vi.fn() });
    }
    expect(panel.windowStyle.value.top).toBe('8px');
    featureBounds.top = 120;
    onFeatureMutation();
    expect(panel.windowStyle.value.top).toBe('128px');
    expect(featureObserver.observe).toHaveBeenCalledWith(expect.any(Object), { attributes: true, attributeFilter: ['class', 'style'] });
  });
});