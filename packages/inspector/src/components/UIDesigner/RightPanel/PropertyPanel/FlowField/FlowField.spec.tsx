import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';

import { FLOW_DIRECTIONS } from '../flow';
import { FlowField } from './FlowField';

const ABSOLUTE_CELL = 0;
const ROW_CELL = 3;

function renderField(value: Record<string, unknown> | null) {
  const onPatch = vi.fn();
  const { container } = render(
    <FlowField
      value={value}
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

describe('when picking the absolute cell', () => {
  it('should anchor the node to the leading edges, not bake its measured offset', () => {
    const { group, onPatch } = renderField({});

    fireEvent.click(group.children[ABSOLUTE_CELL]);

    expect(onPatch).toHaveBeenCalledWith(
      expect.objectContaining({ positionTop: 0, positionLeft: 0 }),
    );
  });
});
