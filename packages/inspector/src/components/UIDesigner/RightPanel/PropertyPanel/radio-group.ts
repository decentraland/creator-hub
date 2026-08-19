// The keyboard half of the panel's icon-segment selectors (Flow, Texture type).
// They are ARIA radio groups, so the group is ONE tab stop and the arrow keys
// move between segments — selecting as they go, because selection follows focus
// in a radio group.

import type React from 'react';

const STEPS: Record<string, number> = {
  ArrowRight: 1,
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowUp: -1,
};

// Bind on the group element, whose children ARE the segments in order — that is
// what lets one handler move focus without a ref per segment.
export function radioGroupKeyDown<T>(values: readonly T[], current: T, select: (next: T) => void) {
  return (e: React.KeyboardEvent<HTMLElement>) => {
    const step = STEPS[e.key];
    const from = values.indexOf(current);
    let next: number;
    if (step !== undefined) next = (from + step + values.length) % values.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = values.length - 1;
    else return;

    e.preventDefault();
    (e.currentTarget.children[next] as HTMLElement | undefined)?.focus();
    if (values[next] !== current) select(values[next]);
  };
}

// Roving tabindex: the selected segment is the group's only tab stop, with the
// first standing in when nothing reads as selected — a group Tab cannot reach at
// all is worse than one that starts on the wrong segment.
export const radioTabIndex = <T>(values: readonly T[], current: T, index: number): 0 | -1 =>
  index === Math.max(values.indexOf(current), 0) ? 0 : -1;
