import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import type { Entity } from '@dcl/ecs';

import {
  YGPT_ABSOLUTE,
  YGU_PERCENT,
  YGU_POINT,
} from '../../../../../lib/sdk/ui-transform-constants';
import { AnchorPresetField } from './AnchorPresetField';

vi.mock('../../../shared/measure', () => ({ measureNodeBox: () => ({ width: 80, height: 40 }) }));

const ENTITY = 512 as Entity;

function renderField(value: Record<string, unknown> | null, onPatch = vi.fn()) {
  const { container } = render(
    <AnchorPresetField
      value={value}
      entity={ENTITY}
      onPatch={onPatch}
    />,
  );
  return { container, onPatch, preview: container.querySelector('.ui-designer-anchor-preview')! };
}

const CENTERED_BOTTOM = {
  positionType: YGPT_ABSOLUTE,
  positionLeft: 50,
  positionLeftUnit: YGU_PERCENT,
  marginLeft: -40,
  marginLeftUnit: YGU_POINT,
  positionBottom: 0,
  positionBottomUnit: YGU_POINT,
};

describe('when the Anchor field shows an authored pin', () => {
  it('should select each axis pin in its own dropdown and accent its line', () => {
    const { preview } = renderField(CENTERED_BOTTOM);

    expect(screen.getByText('Center')).toBeTruthy();
    expect(screen.getByText('Bottom')).toBeTruthy();
    expect(preview.getAttribute('data-h')).toBe('center');
    expect(preview.getAttribute('data-v')).toBe('bottom');
  });

  it('should leave the unpinned axis without an accented line', () => {
    const { preview } = renderField({
      positionType: YGPT_ABSOLUTE,
      positionLeft: 12,
      positionLeftUnit: YGU_POINT,
    });

    expect(preview.getAttribute('data-h')).toBe('left');
    expect(preview.getAttribute('data-v')).toBeNull();
  });

  it('should read None on an axis with no pinned edge', () => {
    renderField({ positionType: YGPT_ABSOLUTE, positionLeft: 12, positionLeftUnit: YGU_POINT });

    expect(screen.getByText('None')).toBeTruthy();
    expect(screen.queryByText('Top')).toBeNull();
  });

  it('should offer None only while the axis is unpinned', () => {
    renderField(CENTERED_BOTTOM);

    expect(screen.queryByText('None')).toBeNull();
  });

  it('should show no accented line at all for a node that is still in flow', () => {
    const { preview } = renderField({ positionLeft: 12, positionLeftUnit: YGU_POINT });

    expect(preview.getAttribute('data-h')).toBeNull();
    expect(preview.getAttribute('data-v')).toBeNull();
  });
});

describe('when a pin is picked', () => {
  it('should patch only the picked axis', () => {
    const { onPatch } = renderField(CENTERED_BOTTOM);

    fireEvent.click(screen.getByText('Bottom'));
    fireEvent.click(screen.getByText('Middle'));

    expect(onPatch).toHaveBeenCalledTimes(1);
    const patch = onPatch.mock.calls[0][0];
    expect(patch).toMatchObject({
      positionTop: 50,
      positionTopUnit: YGU_PERCENT,
      marginTop: -20,
      marginTopUnit: YGU_POINT,
    });
    expect(Object.keys(patch).filter(k => /Left|Right/.test(k))).toEqual([]);
  });
});
