import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';

import type { Entity } from '@dcl/ecs';

import { FLOW_DIRECTIONS } from '../flow';
import { FlowField } from './FlowField';

// measure.ts reaches into the canvas DOM for the node's rendered offset; the
// keyboard pattern does not care where the node sits.
vi.mock('../measure', () => ({ measureNodeOffset: () => null }));

const ENTITY = 512 as Entity;

// CELLS order: absolute, column, column-reverse, row, row-reverse.
const ROW_CELL = 3;

function renderField(value: Record<string, unknown> | null) {
  const onPatch = vi.fn();
  const { container } = render(
    <FlowField
      value={value}
      entity={ENTITY}
      onPatch={onPatch}
    />,
  );
  return { onPatch, group: container.querySelector('[role="radiogroup"]') as HTMLElement };
}

describe('when the Flow selector has focus', () => {
  it('should be one tab stop, on the selected cell', () => {
    const { group } = renderField({});
    const stops = [...group.children].map(cell => cell.getAttribute('tabindex'));

    expect(stops).toEqual(['-1', '-1', '-1', '0', '-1']);
  });

  it('should move the selection with the arrow keys', () => {
    const { group, onPatch } = renderField({});

    fireEvent.keyDown(group, { key: 'ArrowRight' });

    expect(onPatch).toHaveBeenCalledWith({ flexDirection: FLOW_DIRECTIONS['row-reverse'] });
    expect(document.activeElement).toBe(group.children[ROW_CELL + 1]);
  });
});
