import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import type { ScriptParamArray, ScriptParamObject } from '../types';
import { ScriptParamField } from './ScriptParamField';

const LEVER = 600;
const CRYSTAL = 700;

const mocks = vi.hoisted(() => ({
  sdk: {
    engine: {
      getComponentOrNull: (name: string) => ({ componentName: name }),
    },
    components: {
      Actions: {
        getOrNull: (entity: number) =>
          entity === 600
            ? { value: [{ name: 'Activate' }, { name: 'Deactivate' }, { name: 'Toggle' }] }
            : null,
      },
    },
  },
}));

vi.mock('../../../../hooks/sdk/useSdk', () => ({ useSdk: () => mocks.sdk }));
vi.mock('../../../Container', () => ({
  Container: ({ label, children }: { label?: string; children?: React.ReactNode }) => (
    <div data-testid="container">
      <div>{label}</div>
      {children}
    </div>
  ),
}));
// The real picker reads the engine; the stub shows which components it was narrowed to.
vi.mock('../../../ui/EntityField/EntityField', () => ({
  default: ({
    components,
    value,
    onChange,
  }: {
    components?: { componentName: string }[];
    value: number;
    onChange: React.ChangeEventHandler<HTMLSelectElement>;
  }) => (
    <select
      aria-label="entity"
      data-components={(components ?? []).map(c => c.componentName).join(',')}
      value={value}
      onChange={onChange}
    >
      <option value="0" />
      <option value="600" />
      <option value="700" />
    </select>
  ),
}));

afterEach(cleanup);

const smartItems = (row: Record<string, unknown>): ScriptParamObject => ({
  type: 'object',
  value: row,
  fields: {
    entity: { type: 'entity', value: 0 as never, components: ['asset-packs::Actions'] },
    customName: { type: 'string', value: '' },
    defaultAction: { type: 'string', value: '', actionsOf: 'entity' },
  },
});

describe('when an entity param names the components it accepts', () => {
  it('should offer only entities with those components, by their latest version', () => {
    render(
      <ScriptParamField
        name="entity"
        param={{ type: 'entity', value: 0 as never, components: ['asset-packs::VideoScreen'] }}
        onUpdate={vi.fn()}
      />,
    );
    const names = screen.getByLabelText('entity').getAttribute('data-components')!;
    expect(names).toMatch(/^asset-packs::VideoScreen(-v\d+)?$/);
  });

  it('should offer every entity when it names none', () => {
    render(
      <ScriptParamField
        name="entity"
        param={{ type: 'entity', value: 0 as never }}
        onUpdate={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('entity').getAttribute('data-components')).toBe('');
  });
});

describe('when a smart item row picks its default action', () => {
  it("should offer the picked item's own actions", () => {
    render(
      <ScriptParamField
        name="row"
        param={smartItems({ entity: LEVER, customName: '', defaultAction: 'Deactivate' })}
        onUpdate={vi.fn()}
      />,
    );
    expect(screen.getByText('Deactivate')).toBeTruthy();
    expect(screen.queryByRole('textbox', { name: /default action/i })).toBeNull();
  });

  it('should flag a stored name that is not one of those actions', () => {
    render(
      <ScriptParamField
        name="row"
        param={smartItems({ entity: LEVER, customName: '', defaultAction: 'open/close' })}
        onUpdate={vi.fn()}
      />,
    );
    expect(screen.getByText('"open/close" is not one of this item\'s actions.')).toBeTruthy();
  });

  it('should clear the default action when another item is picked', () => {
    const onUpdate = vi.fn();
    render(
      <ScriptParamField
        name="row"
        param={smartItems({ entity: LEVER, customName: 'Gate', defaultAction: 'Activate' })}
        onUpdate={onUpdate}
      />,
    );
    fireEvent.change(screen.getByLabelText('entity'), { target: { value: String(CRYSTAL) } });
    const updater = onUpdate.mock.calls[0][0] as (prev: unknown) => unknown;
    expect(updater({ entity: LEVER, customName: 'Gate', defaultAction: 'Activate' })).toEqual({
      entity: CRYSTAL,
      customName: 'Gate',
      defaultAction: '',
    });
  });
});

describe('when a wallet list row is confirmed with Enter', () => {
  const wallets: ScriptParamArray = {
    type: 'array',
    value: [''],
    item: { type: 'string', value: '', format: 'wallet' },
  };

  it('should save the pasted address right away, trimmed', () => {
    const onUpdate = vi.fn();
    const { container } = render(
      <ScriptParamField
        name="adminAllowList"
        param={wallets}
        onUpdate={onUpdate}
      />,
    );
    const input = container.querySelector('.ArrayFieldRow input') as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '0x1234567890123456789012345678901234567890 ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onUpdate).toHaveBeenCalledTimes(1);
    const updater = onUpdate.mock.calls[0][0] as (prev: unknown) => unknown;
    expect(updater([''])).toEqual(['0x1234567890123456789012345678901234567890']);
  });

  it('should line the remove button up with the field', () => {
    const { container } = render(
      <ScriptParamField
        name="adminAllowList"
        param={wallets}
        onUpdate={vi.fn()}
      />,
    );
    expect(container.querySelector('.ArrayFieldRow')!.classList.contains('leaf')).toBe(true);
  });
});
