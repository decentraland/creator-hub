import React, { useRef } from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';

import { usePopoverPosition } from './usePopoverPosition';

interface HarnessProps {
  rects: { anchor: Partial<DOMRect>; popover: Partial<DOMRect> };
  width?: number;
  align?: 'left' | 'right';
  gap?: number;
}

let placed: { top: number; left: number };
let popoverEl: HTMLDivElement | null;

function Harness({ rects, ...options }: HarnessProps) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  placed = usePopoverPosition({
    anchorRef,
    popoverRef,
    open: true,
    onDismiss: () => {},
    ...options,
  });
  return (
    <>
      <div
        ref={el => {
          if (el) el.getBoundingClientRect = () => rects.anchor as DOMRect;
          (anchorRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
        }}
      />
      <div
        ref={el => {
          if (el) el.getBoundingClientRect = () => rects.popover as DOMRect;
          (popoverRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
          popoverEl = el;
        }}
      />
    </>
  );
}

const anchorAt = (top: number, extra: Partial<DOMRect> = {}) =>
  ({ top, bottom: top + 24, left: 100, right: 260, width: 160, height: 24, ...extra }) as DOMRect;

describe('usePopoverPosition', () => {
  beforeEach(() => {
    window.innerHeight = 600;
    window.innerWidth = 1000;
    popoverEl = null;
  });

  it('places the popover below its anchor when there is room', () => {
    render(
      <Harness
        rects={{ anchor: anchorAt(100), popover: { width: 160, height: 132 } }}
        width={160}
        gap={1}
      />,
    );
    expect(placed.top).toBe(125);
    expect(placed.left).toBe(100);
  });

  it('flips above the anchor when the popover would overflow below', () => {
    render(
      <Harness
        rects={{ anchor: anchorAt(500), popover: { width: 160, height: 132 } }}
        width={160}
        gap={1}
      />,
    );
    expect(placed.top).toBe(367);
  });

  it('lines the right edges up when aligned right', () => {
    render(
      <Harness
        rects={{ anchor: anchorAt(100), popover: { width: 200, height: 100 } }}
        align="right"
        gap={1}
      />,
    );
    expect(placed.left).toBe(60);
  });

  it('keeps the popover inside the viewport when the anchor sits at the edge', () => {
    render(
      <Harness
        rects={{
          anchor: anchorAt(100, { left: 960, right: 1000 }),
          popover: { width: 200, height: 100 },
        }}
        width={200}
        gap={4}
      />,
    );
    expect(placed.left).toBe(796);
  });

  // A menu taller than the window fit nowhere and used to run off the bottom edge, unreachable.
  it('caps a popover that fits on neither side so it scrolls within the roomier one', () => {
    render(
      <Harness
        rects={{ anchor: anchorAt(200), popover: { width: 160, height: 740 } }}
        width={160}
        gap={4}
      />,
    );
    expect(popoverEl?.style.maxHeight).toBe('368px');
    expect(placed.top).toBe(228);
  });

  it('leaves the height alone when the popover fits', () => {
    render(
      <Harness
        rects={{ anchor: anchorAt(100), popover: { width: 160, height: 132 } }}
        width={160}
        gap={4}
      />,
    );
    expect(popoverEl?.style.maxHeight).toBe('');
  });
});
