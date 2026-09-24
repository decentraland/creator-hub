import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';

import type { ScriptParamArray, ScriptParamObject } from '../types';
import { ScriptParamField } from './ScriptParamField';

// Container pulls SDK clipboard context we don't need here; a passthrough keeps the test
// focused on the new object/array editors (field iteration, add/remove, onUpdate bubbling).
vi.mock('../../../Container', () => ({
  Container: ({ label, children }: { label?: string; children?: React.ReactNode }) => (
    <div data-testid="container">
      <div>{label}</div>
      {children}
    </div>
  ),
}));

describe('ObjectField', () => {
  const objectParam: ScriptParamObject = {
    type: 'object',
    optional: true,
    value: { isEnabled: true, title: 'hello', nested: { count: 2 } },
    fields: {
      isEnabled: { type: 'boolean', value: false },
      title: { type: 'string', value: '' },
      nested: {
        type: 'object',
        value: { count: 0 },
        fields: { count: { type: 'number', value: 0 } },
      },
    },
  };

  it('renders a sub-field per key, including a nested object', () => {
    render(
      <ScriptParamField
        name="moderationControl"
        param={objectParam}
        onUpdate={vi.fn()}
      />,
    );
    expect(screen.getByText('Moderation Control')).toBeTruthy();
    expect(screen.getByText('Is Enabled')).toBeTruthy();
    expect(screen.getByText('Title')).toBeTruthy();
    // nested object header + its inner field
    expect(screen.getByText('Nested')).toBeTruthy();
    expect(screen.getByText('Count')).toBeTruthy();
  });

  it('bubbles the whole updated object when a field changes', () => {
    const onUpdate = vi.fn();
    const { container } = render(
      <ScriptParamField
        name="cfg"
        param={objectParam}
        onUpdate={onUpdate}
      />,
    );
    // isEnabled is the only checkbox (nested.count is a number field)
    const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
    fireEvent.click(checkbox);
    expect(onUpdate).toHaveBeenCalledWith({
      isEnabled: false,
      title: 'hello',
      nested: { count: 2 },
    });
  });
});

describe('ArrayField', () => {
  const stringList: ScriptParamArray = {
    type: 'array',
    optional: true,
    value: ['0xabc', '0xdef'],
    item: { type: 'string', value: '' },
  };

  it('renders one row per element', () => {
    render(
      <ScriptParamField
        name="adminAllowList"
        param={stringList}
        onUpdate={vi.fn()}
      />,
    );
    // labels are the 1-based row indices
    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
  });

  it('appends a cloned item default on Add', () => {
    const onUpdate = vi.fn();
    render(
      <ScriptParamField
        name="adminAllowList"
        param={stringList}
        onUpdate={onUpdate}
      />,
    );
    fireEvent.click(screen.getByText('Add'));
    expect(onUpdate).toHaveBeenCalledWith(['0xabc', '0xdef', '']);
  });

  it('removes the targeted row', () => {
    const onUpdate = vi.fn();
    const { container } = render(
      <ScriptParamField
        name="adminAllowList"
        param={stringList}
        onUpdate={onUpdate}
      />,
    );
    const removeButtons = container.querySelectorAll('.ArrayFieldRemove');
    expect(removeButtons.length).toBe(2);
    fireEvent.click(removeButtons[0]);
    expect(onUpdate).toHaveBeenCalledWith(['0xdef']);
  });

  it('renders a list of objects with per-row sub-fields', () => {
    const objectList: ScriptParamArray = {
      type: 'array',
      value: [{ customName: 'Main Screen' }],
      item: {
        type: 'object',
        value: { customName: '' },
        fields: { customName: { type: 'string', value: '' } },
      },
    };
    render(
      <ScriptParamField
        name="videoPlayers"
        param={objectList}
        onUpdate={vi.fn()}
      />,
    );
    const row = screen.getByText('1').closest('[data-testid="container"]') as HTMLElement;
    expect(within(row).getByText('Custom Name')).toBeTruthy();
  });
});
