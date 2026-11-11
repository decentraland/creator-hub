import { beforeEach, describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';

import type { ScriptParamArray, ScriptParamColor, ScriptParamObject } from '../types';
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

  it('bubbles a functional update that merges the change into the freshest object', () => {
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
    // Containers emit a `(prev) => next` updater, not the whole value, so concurrent sibling edits
    // compose instead of clobbering. Applying it to the current object yields the merged result.
    const updater = onUpdate.mock.calls[0][0] as (prev: unknown) => unknown;
    expect(typeof updater).toBe('function');
    expect(updater(objectParam.value)).toEqual({
      isEnabled: false,
      title: 'hello',
      nested: { count: 2 },
    });
  });

  it('composes two sibling edits without clobbering (the data-loss regression)', () => {
    const onUpdate = vi.fn();
    // Two boolean siblings (checkboxes commit immediately, unlike debounced text/number fields).
    const twoBools: ScriptParamObject = {
      type: 'object',
      value: { a: true, b: true },
      fields: { a: { type: 'boolean', value: false }, b: { type: 'boolean', value: false } },
    };
    const { container } = render(
      <ScriptParamField
        name="cfg"
        param={twoBools}
        onUpdate={onUpdate}
      />,
    );
    const boxes = container.querySelectorAll('input[type="checkbox"]');
    fireEvent.click(boxes[0]); // a -> false
    fireEvent.click(boxes[1]); // b -> false
    const u1 = onUpdate.mock.calls[0][0] as (p: unknown) => unknown;
    const u2 = onUpdate.mock.calls[1][0] as (p: unknown) => unknown;
    // Apply both against the SAME starting value (as if both fired before a re-render): composing
    // the two updaters must keep both edits — the second must not revert the first.
    expect(u2(u1({ a: true, b: true }))).toEqual({ a: false, b: false });
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
    const updater = onUpdate.mock.calls[0][0] as (prev: unknown) => unknown;
    expect(updater(['0xabc', '0xdef'])).toEqual(['0xabc', '0xdef', '']);
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
    const updater = onUpdate.mock.calls[0][0] as (prev: unknown) => unknown;
    expect(updater(['0xabc', '0xdef'])).toEqual(['0xdef']);
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

describe('when a string nested in an object list names a missing file', () => {
  const tracks: ScriptParamArray = {
    type: 'array',
    value: [{ clip: 'gone.mp3' }, { clip: 'here.mp3' }],
    item: {
      type: 'object',
      value: { clip: '' },
      fields: { clip: { type: 'string', value: '' } },
    },
  };
  const getError = (param: { type: string; value: unknown }) =>
    param.type === 'string' && param.value === 'gone.mp3' ? '"gone.mp3" is missing' : undefined;

  beforeEach(() => {
    render(
      <ScriptParamField
        name="tracks"
        param={tracks}
        getError={getError}
        onUpdate={vi.fn()}
      />,
    );
  });

  it('should show the warning under that field', () => {
    expect(screen.getByText('"gone.mp3" is missing')).toBeTruthy();
  });

  it('should show it only once', () => {
    expect(screen.getAllByText(/is missing/)).toHaveLength(1);
  });
});

describe('when rendering a colour param', () => {
  const pickColor = (container: HTMLElement, hex: string) =>
    fireEvent.change(container.querySelector('input[type="color"]') as HTMLInputElement, {
      target: { value: hex },
    });

  describe('and it holds a custom Color3', () => {
    const tint: ScriptParamColor = { type: 'color', value: { r: 0.2, g: 0.4, b: 0.6 } };

    it('should show the colour picker with its hex value', () => {
      const { container } = render(
        <ScriptParamField
          name="tint"
          param={tint}
          onUpdate={vi.fn()}
        />,
      );
      const picker = container.querySelector('input[type="color"]') as HTMLInputElement;
      expect(picker.value).toBe('#336699');
    });

    it('should emit the picked colour as a Color3', () => {
      const onUpdate = vi.fn();
      const { container } = render(
        <ScriptParamField
          name="tint"
          param={tint}
          onUpdate={onUpdate}
        />,
      );
      pickColor(container, '#ff0000');
      expect(onUpdate).toHaveBeenCalledWith({ r: 1, g: 0, b: 0 });
    });
  });

  describe('and it holds one of the stock colours', () => {
    let container: HTMLElement;

    beforeEach(() => {
      ({ container } = render(
        <ScriptParamField
          name="tint"
          param={{ type: 'color', value: { r: 1, g: 1, b: 1 } }}
          onUpdate={vi.fn()}
        />,
      ));
    });

    it('should show only the colour picker, with no colour list to choose from', () => {
      expect(container.querySelector('input[type="color"]')).not.toBeNull();
      expect(container.querySelector('.Dropdown')).toBeNull();
    });

    it('should show the param name as the label', () => {
      expect(screen.getByText(/^tint$/i)).toBeTruthy();
    });
  });

  describe('and its value changes from outside the picker', () => {
    it('should show the new colour', () => {
      const tint: ScriptParamColor = { type: 'color', value: { r: 0.2, g: 0.4, b: 0.6 } };
      const { container, rerender } = render(
        <ScriptParamField
          name="tint"
          param={tint}
          onUpdate={vi.fn()}
        />,
      );
      rerender(
        <ScriptParamField
          name="tint"
          param={{ ...tint, value: { r: 1, g: 0, b: 0 } }}
          onUpdate={vi.fn()}
        />,
      );
      const preview = container.querySelector('.ColorPickerTextField input') as HTMLInputElement;
      expect(preview.value.toLowerCase()).toBe('#ff0000');
    });
  });

  describe('and it holds a Color4', () => {
    const tint: ScriptParamColor = { type: 'color', value: { r: 0.2, g: 0.4, b: 0.6, a: 0.3 } };

    it('should keep the alpha when a new colour is picked', () => {
      const onUpdate = vi.fn();
      const { container } = render(
        <ScriptParamField
          name="tint"
          param={tint}
          onUpdate={onUpdate}
        />,
      );
      pickColor(container, '#00ff00');
      expect(onUpdate).toHaveBeenCalledWith({ r: 0, g: 1, b: 0, a: 0.3 });
    });
  });
});

describe('when a param is tied to a sibling with @enabledIf', () => {
  const sunHeight = {
    type: 'slider' as const,
    value: 45,
    min: 0,
    max: 90,
    step: 1,
    enabledIf: 'fixSunPosition',
  };

  function renderSunHeight(siblings: Record<string, unknown>, enabledIf = sunHeight.enabledIf) {
    const { container } = render(
      <ScriptParamField
        name="sunHeight"
        param={{ ...sunHeight, enabledIf }}
        siblings={siblings}
        onUpdate={vi.fn()}
      />,
    );
    return container;
  }

  describe('and the sibling is off', () => {
    it('should grey out the field and lock its inputs', () => {
      const container = renderSunHeight({ fixSunPosition: false });
      const fieldset = container.querySelector('fieldset.ScriptParamField.disabled');
      expect(fieldset?.hasAttribute('disabled')).toBe(true);
      const inputs = Array.from(container.querySelectorAll('input'));
      expect(inputs.length).toBeGreaterThan(0);
      expect(inputs.every(input => input.disabled)).toBe(true);
    });
  });

  describe('and the sibling is on', () => {
    it('should leave the field editable', () => {
      const container = renderSunHeight({ fixSunPosition: true });
      expect(container.querySelector('fieldset')).toBeNull();
      expect((container.querySelector('input[type="range"]') as HTMLInputElement).disabled).toBe(
        false,
      );
    });
  });

  describe('and the tag is negated', () => {
    it('should lock the field while the sibling is on', () => {
      const container = renderSunHeight({ fixSunPosition: true }, '!fixSunPosition');
      expect(container.querySelector('fieldset.ScriptParamField.disabled')).not.toBeNull();
    });
  });
});
