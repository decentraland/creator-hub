import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Entity } from '@dcl/ecs';

import { YGU_PERCENT, YGU_POINT } from '../../../../../lib/sdk/ui-transform-constants';
import { BoxModelField } from './BoxModelField';

function renderField(value: Record<string, unknown>) {
  const onPatch = vi.fn();
  render(
    <>
      <BoxModelField
        value={value}
        componentId="core::UiTransform"
        entity={1 as unknown as Entity}
        box="padding"
        onPatch={onPatch}
      />
      <BoxModelField
        value={value}
        componentId="core::UiTransform"
        entity={1 as unknown as Entity}
        box="margin"
        onPatch={onPatch}
      />
    </>,
  );
  return { onPatch };
}

// TextField debounces onChange (0ms, but still a timer), so the patch lands a
// tick after the event rather than inside fireEvent.
function type(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

describe('when every edge is unauthored', () => {
  it('should label the inputs px, which is what an edit writes', () => {
    renderField({});

    expect(screen.getAllByText('px')).toHaveLength(8);
    expect(screen.queryByText('%')).toBeNull();
  });

  it('should write a px unit alongside the number', async () => {
    const { onPatch } = renderField({});

    type('padding top', '12');

    await waitFor(() =>
      expect(onPatch).toHaveBeenCalledWith({ paddingTop: 12, paddingTopUnit: YGU_POINT }),
    );
  });
});

// The panel offers no unit selector here, so a percent edge can only be
// hand-authored — but it parses cleanly, and the grid used to render it as a bare
// number and then silently reinterpret it as px on the next keystroke.
describe('when an edge is hand-authored as a percentage', () => {
  it('should label that edge % and leave the others px', () => {
    renderField({ marginTop: 10, marginTopUnit: YGU_PERCENT });

    expect(screen.getAllByText('%')).toHaveLength(1);
    expect(screen.getAllByText('px')).toHaveLength(7);
  });

  it('should keep the percent unit when the number is edited', async () => {
    const { onPatch } = renderField({ marginTop: 10, marginTopUnit: YGU_PERCENT });

    type('margin top', '25');

    await waitFor(() =>
      expect(onPatch).toHaveBeenCalledWith({ marginTop: 25, marginTopUnit: YGU_PERCENT }),
    );
  });

  it('should not spread that unit onto a sibling edge', async () => {
    const { onPatch } = renderField({ marginTop: 10, marginTopUnit: YGU_PERCENT });

    type('margin left', '4');

    await waitFor(() =>
      expect(onPatch).toHaveBeenCalledWith({ marginLeft: 4, marginLeftUnit: YGU_POINT }),
    );
  });
});
