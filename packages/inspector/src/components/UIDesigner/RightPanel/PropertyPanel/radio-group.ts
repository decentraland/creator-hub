import type React from 'react';

const STEPS: Record<string, number> = {
  ArrowRight: 1,
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowUp: -1,
};

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

export const radioTabIndex = <T>(values: readonly T[], current: T, index: number): 0 | -1 =>
  index === Math.max(values.indexOf(current), 0) ? 0 : -1;
