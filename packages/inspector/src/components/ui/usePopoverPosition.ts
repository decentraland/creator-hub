import { useLayoutEffect, useRef, useState } from 'react';

interface PopoverPositionOptions {
  // The element the popover is anchored to.
  anchorRef: React.RefObject<HTMLElement>;
  // The popover element (used to ignore clicks inside it for outside-dismiss).
  popoverRef: React.RefObject<HTMLElement>;
  // Whether the popover is currently shown. Listeners attach only while open.
  open: boolean;
  // Called on an outside (neither anchor nor popover) mousedown.
  onDismiss: () => void;
  // Popover width used to clamp against the viewport's right edge.
  width: number;
  // Gap between the anchor and the popover (and the viewport edges).
  gap?: number;
}

// Position a `position: fixed` popover under its anchor and keep it there.
//
// Shared by VariablePicker and RgbaColorField, which had a verbatim copy of this
// layout effect: place below the anchor, clamp to the viewport's right edge,
// reposition on scroll (capture, so nested scrollers count) / resize, and dismiss
// on an outside mousedown. `onDismiss` is read through a ref so the listener effect
// re-subscribes only when `open` flips, not on every render.
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
      const left = Math.min(a.left, window.innerWidth - width - gap);
      setPos({ top: a.bottom + gap, left: Math.max(gap, left) });
    };
    place();
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (popoverRef.current?.contains(t) || anchorRef.current?.contains(t)) return;
      dismissRef.current();
    };
    window.addEventListener('scroll', place, { capture: true, passive: true });
    window.addEventListener('resize', place);
    document.addEventListener('mousedown', onDoc);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
      document.removeEventListener('mousedown', onDoc);
    };
  }, [open, anchorRef, popoverRef, width, gap]);

  return pos;
}

export default usePopoverPosition;
