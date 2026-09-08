import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';

import { FLOW_DIRECTIONS } from '../flow';
import { FlowField } from './FlowField';

const FREE_CELL = 0;
const COLUMN_CELL = 1;

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
  it('should be one tab stop, on the selected (Free) cell', () => {
    const { group } = renderField({});
    const stops = [...group.children].map(cell => cell.getAttribute('tabindex'));

    expect(stops).toEqual(['0', '-1', '-1', '-1', '-1']);
  });

  it('should move the selection with the arrow keys', () => {
    const { group, onPatch } = renderField({});

    fireEvent.keyDown(group, { key: 'ArrowRight' });

    expect(onPatch).toHaveBeenCalledWith({ flexDirection: FLOW_DIRECTIONS.column });
    expect(document.activeElement).toBe(group.children[COLUMN_CELL]);
  });
});

describe('when picking the Free cell', () => {
  it('clears flexDirection and leaves the node’s positionType untouched', () => {
    const { group, onPatch } = renderField({ flexDirection: FLOW_DIRECTIONS.column });

    fireEvent.click(group.children[FREE_CELL]);

    const patch = onPatch.mock.calls[0][0] as Record<string, unknown>;
    expect('flexDirection' in patch).toBe(true);
    expect(patch.flexDirection).toBeUndefined();
    expect(patch).not.toHaveProperty('positionType');
  });
});
