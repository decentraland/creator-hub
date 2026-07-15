import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { VariablePicker } from './VariablePicker';

// Code mode: the picker lists the parsed binding surface (typed `state` vars +
// @ui-bind markers), not the classic asset-packs::UI marker.
vi.mock('../code/store', () => ({
  useCodeState: () => ({
    bindingSurface: {
      variables: [
        { name: 'label', type: 'string', expr: 'state.label' },
        { name: 'score', type: 'number', expr: 'state.score' },
        { name: 'flag', type: 'boolean', expr: 'state.flag' },
      ],
      actions: [{ name: 'onClick' }, { name: 'onHover' }],
    },
  }),
  addBindVariable: vi.fn(),
  addBindAction: vi.fn(),
}));

function renderPicker(kind: string) {
  const anchorRef = { current: document.createElement('button') };
  return render(
    <VariablePicker
      field={{ label: 'X', componentId: 'core::UiText', path: 'value', kind } as any}
      anchorRef={anchorRef as any}
      onPick={() => {}}
      onDismiss={() => {}}
    />,
  );
}

describe('VariablePicker type restriction (code mode)', () => {
  it('offers every variable for a string field, flagging coercions', () => {
    renderPicker('string');
    expect(screen.getByText('label')).toBeTruthy();
    expect(screen.getByText('score (number → string)')).toBeTruthy();
    expect(screen.getByText('flag (boolean → string)')).toBeTruthy();
  });

  it('offers only number variables for a number field', () => {
    renderPicker('number');
    expect(screen.getByText('score')).toBeTruthy();
    expect(screen.queryByText('label')).toBeNull();
    expect(screen.queryByText(/flag/)).toBeNull();
  });

  it('offers no variables for a color field (no compatible code type)', () => {
    renderPicker('color');
    expect(screen.getByText('No compatible variables.')).toBeTruthy();
  });

  it('lists event handlers (not variables) for a callback field', () => {
    renderPicker('callback');
    expect(screen.getByText('onClick()')).toBeTruthy();
    expect(screen.getByText('onHover()')).toBeTruthy();
    // Variables are not offered on a callback field.
    expect(screen.queryByText('label')).toBeNull();
    expect(screen.getByText('+ Add new callback…')).toBeTruthy();
  });
});
