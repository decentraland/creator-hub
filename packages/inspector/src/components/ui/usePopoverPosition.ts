import { useLayoutEffect, useRef, useState } from 'react';

interface PopoverPositionOptions {
  anchorRef: React.RefObject<HTMLElement>;
  popoverRef: React.RefObject<HTMLElement>;
  open: boolean;
  onDismiss: () => void;
  width: number;
  gap?: number;
}

/** Positions a fixed popover by its anchor (below, or flipped above when clipped); dismisses on outside mousedown or scroll. */
export function usePopoverPosition({
  anchorRef,
  popoverRef,
  open,
  onDismiss,
  width,
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
      const left = Math.max(gap, Math.min(a.left, window.innerWidth - width - gap));
      const height = popoverRef.current?.getBoundingClientRect().height ?? 0;
      const overflowsBelow = a.bottom + gap + height + gap > window.innerHeight;
      const fitsAbove = a.top - gap - height >= gap;
      const top = overflowsBelow && fitsAbove ? a.top - gap - height : a.bottom + gap;
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
  }, [open, anchorRef, popoverRef, width, gap]);

  return pos;
}

export default usePopoverPosition;
