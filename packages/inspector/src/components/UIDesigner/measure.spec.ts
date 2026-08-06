import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Entity } from '@dcl/ecs';

const elements = new Map<number, HTMLElement>();

vi.mock('./node-registry', () => ({
  getNodeElement: (entity: unknown) => elements.get(Number(entity)),
}));

import { measureNodeOffset, measureParentBox, setCanvasScale } from './measure';

const NODE = 1 as unknown as Entity;

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

// happy-dom does no layout, so every rect is stated outright — which is what makes
// the arithmetic (and the edges it must and must not subtract) testable at all.
function box(el: HTMLElement, rect: Box): HTMLElement {
  el.getBoundingClientRect = () =>
    ({
      ...rect,
      right: rect.left + rect.width,
      bottom: rect.top + rect.height,
      x: rect.left,
      y: rect.top,
    }) as DOMRect;
  return el;
}

// A node inside a parent, both with a stated rect. The parent's edges are styled
// the way nodeStyle writes them — a border width always paired with a border
// style, since a browser computes an unstyled border's width as 0.
function tree(opts: {
  parent: Box;
  child: Box;
  border?: number;
  padding?: number;
  absolute?: boolean;
}): void {
  const parent = box(document.createElement('div'), opts.parent);
  if (opts.border) {
    for (const side of ['Top', 'Right', 'Bottom', 'Left']) {
      parent.style.setProperty(`border-${side.toLowerCase()}-style`, 'solid');
      parent.style.setProperty(`border-${side.toLowerCase()}-width`, `${opts.border}px`);
    }
  }
  if (opts.padding) parent.style.setProperty('padding', `${opts.padding}px`);
  const child = box(document.createElement('div'), opts.child);
  child.style.setProperty('position', opts.absolute ? 'absolute' : 'relative');
  parent.appendChild(child);
  document.body.appendChild(parent);
  elements.set(1, child);
}

describe('measuring the canvas DOM', () => {
  beforeEach(() => {
    elements.clear();
    document.body.replaceChildren();
    setCanvasScale(1);
  });

  describe("when measuring a node's offset in its parent", () => {
    it('should measure from the parent box when the parent has no edges', () => {
      tree({
        parent: { top: 100, left: 100, width: 400, height: 300 },
        child: { top: 120, left: 140, width: 50, height: 20 },
      });
      expect(measureNodeOffset(NODE)).toEqual({ top: 20, left: 40 });
    });

    // An absolute inset is measured from the parent's PADDING box, so the parent's
    // border is not part of the offset: leaving it in moved a node by that border
    // every time it was converted to absolute or dragged.
    it("should measure from inside the parent's border", () => {
      tree({
        parent: { top: 100, left: 100, width: 400, height: 300 },
        child: { top: 120, left: 140, width: 50, height: 20 },
        border: 4,
      });
      expect(measureNodeOffset(NODE)).toEqual({ top: 16, left: 36 });
    });

    // ...and the padding IS part of it: an inset does not skip the padding, so the
    // distance the padding put the node there has to be written into the inset.
    it("should keep the parent's padding in the offset", () => {
      tree({
        parent: { top: 100, left: 100, width: 400, height: 300 },
        child: { top: 120, left: 140, width: 50, height: 20 },
        padding: 20,
      });
      expect(measureNodeOffset(NODE)).toEqual({ top: 20, left: 40 });
    });

    // Rects are viewport px and scale with the zoom; a declared border is a logical
    // length and does not. Descaling both would shrink the correction at zoom.
    it('should descale the rect but not the declared border', () => {
      setCanvasScale(2);
      tree({
        parent: { top: 0, left: 0, width: 800, height: 600 },
        child: { top: 68, left: 108, width: 100, height: 40 },
        border: 4,
      });
      expect(measureNodeOffset(NODE)).toEqual({ top: 30, left: 50 });
    });

    it('should report no offset for a node that is not in the canvas DOM', () => {
      expect(measureNodeOffset(NODE)).toBeNull();
    });
  });

  describe("when measuring the box a node's percentages resolve against", () => {
    const PARENT = {
      parent: { top: 0, left: 0, width: 200, height: 100 },
      child: { top: 0, left: 0, width: 10, height: 10 },
    };

    it('should give an in-flow node the content box', () => {
      tree({ ...PARENT, border: 2, padding: 10 });
      expect(measureParentBox(NODE)).toEqual({ width: 176, height: 76 });
    });

    // An absolute node's containing block is the padding box — Yoga subtracts the
    // parent's border from the containing block size and nothing else.
    it('should give an absolute node the padding box', () => {
      tree({ ...PARENT, border: 2, padding: 10, absolute: true });
      expect(measureParentBox(NODE)).toEqual({ width: 196, height: 96 });
    });

    it('should descale the parent rect at zoom', () => {
      setCanvasScale(0.5);
      tree(PARENT);
      expect(measureParentBox(NODE)).toEqual({ width: 400, height: 200 });
    });
  });
});
