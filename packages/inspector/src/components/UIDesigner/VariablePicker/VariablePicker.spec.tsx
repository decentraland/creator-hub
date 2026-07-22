import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VariableType } from '@dcl/asset-packs';

import { VariablePicker } from './VariablePicker';

vi.mock('../../../hooks/sdk/useSdk', () => ({
  useSdk: () => ({
    engine: {
      getComponentOrNull: () => ({
        getOrNull: () => ({
          variables: [
            { name: 'label', type: VariableType.STRING, defaultValue: '' },
            { name: 'onClick', type: VariableType.CALLBACK, defaultValue: '' },
          ],
        }),
      }),
    },
  }),
}));

function renderPicker(kind: 'callback' | 'color') {
  const anchorRef = { current: document.createElement('button') };
  return render(
    <VariablePicker
      field={{ label: 'X', componentId: 'core::UiInput', path: 'onChange', kind } as any}
      selectedRoot={1 as any}
      anchorRef={anchorRef as any}
      onPick={() => {}}
      onDismiss={() => {}}
    />,
  );
}

describe('VariablePicker type restriction', () => {
  it('offers only callback variables for a callback field', () => {
    renderPicker('callback');
    expect(screen.getByText('onClick')).toBeTruthy();
    expect(screen.queryByText('label')).toBeNull();
  });

  it('never offers callback variables for a non-callback field', () => {
    renderPicker('color');
    expect(screen.queryByText('onClick')).toBeNull();
  });
});
