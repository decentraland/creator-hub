import { useLayoutEffect, useRef, useState } from 'react';

interface PopoverPositionOptions {
  anchorRef: React.RefObject<HTMLElement>;
  popoverRef: React.RefObject<HTMLElement>;
  open: boolean;
  onDismiss: () => void;
  /** Omit to measure the rendered popover instead — required when it sizes to its own content. */
  width?: number;
  /** Which popover edge lines up with the same edge of the anchor. */
  align?: 'left' | 'right';
  gap?: number;
}

/**
 * Positions a fixed popover by its anchor (below, or flipped above when clipped); dismisses on
 * outside mousedown or scroll. When the popover fits on neither side it takes the roomier one and
 * is capped to scroll within it, so a long menu can never run off the viewport.
 */
export function usePopoverPosition({
  anchorRef,
  popoverRef,
  open,
  onDismiss,
  width,
  align = 'left',
  gap = 4,
}: PopoverPositionOptions): { top: number; left: number } {
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const a = anchorRef.current?.getBoundingClientRect();
      if (!a) return;
      // The cap is written straight to the node rather than fed back through React: measuring an
      // already-capped popover would report it as fitting and drop the cap on the next placement.
      const popover = popoverRef.current;
      if (popover) popover.style.maxHeight = '';
      const box = popover?.getBoundingClientRect();

      const w = width ?? box?.width ?? 0;
      const anchored = align === 'right' ? a.right - w : a.left;
      const left = Math.max(gap, Math.min(anchored, window.innerWidth - w - gap));

      const height = box?.height ?? 0;
      const roomBelow = window.innerHeight - a.bottom - gap * 2;
      const roomAbove = a.top - gap * 2;
      const fitsBelow = height <= roomBelow;
      const fitsAbove = height <= roomAbove;
      const above = !fitsBelow && (fitsAbove || roomAbove > roomBelow);
      const room = above ? roomAbove : roomBelow;
      if (popover && !fitsBelow && !fitsAbove) popover.style.maxHeight = `${Math.max(gap, room)}px`;

      const top = above ? a.top - gap - Math.min(height, room) : a.bottom + gap;
      setPos({ top: Math.max(gap, top), left });
    };
    place();
    const onScroll = (e: Event) => {
      if (popoverRef.current?.contains(e.target as Node)) return;
      dismissRef.current();
    };
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (popoverRef.current?.contains(t) || anchorRef.current?.contains(t)) return;
      dismissRef.current();
    };
    window.addEventListener('scroll', onScroll, { capture: true, passive: true });
    window.addEventListener('resize', place);
    document.addEventListener('mousedown', onDoc);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', place);
      document.removeEventListener('mousedown', onDoc);
    };
  }, [open, anchorRef, popoverRef, width, align, gap]);

  return pos;
}

export default usePopoverPosition;
