import { afterEach, describe, expect, it } from 'vitest';

import { getViewportRect, setViewportElement } from './viewport-rect';

afterEach(() => setViewportElement(null));

describe('viewport-rect registry', () => {
  it('returns null when no viewport element is registered', () => {
    expect(getViewportRect()).toBeNull();
  });

  it('reports the registered element rect plus the device pixel ratio', () => {
    const el = {
      getBoundingClientRect: () => ({ x: 10, y: 20, width: 640, height: 360 }),
    } as unknown as HTMLElement;
    setViewportElement(el);
    expect(getViewportRect()).toEqual({
      x: 10,
      y: 20,
      width: 640,
      height: 360,
      devicePixelRatio: window.devicePixelRatio || 1,
    });
  });

  it('returns null for a zero-area element (viewport not laid out yet)', () => {
    const el = {
      getBoundingClientRect: () => ({ x: 0, y: 0, width: 0, height: 0 }),
    } as unknown as HTMLElement;
    setViewportElement(el);
    expect(getViewportRect()).toBeNull();
  });
});
