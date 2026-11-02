import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import type { FieldConfig } from '../field-configs';
import { CallbackField, thunkExprFor } from './CallbackField';

const store = vi.hoisted(() => ({
  bindAttribute: vi.fn(),
  unbindAttribute: vi.fn(),
  addBindAction: vi.fn(async () => {}),
  actions: [{ name: 'onPress' }, { name: 'onRelease' }],
}));

vi.mock('../../../code/store', () => ({
  useCodeState: () => ({ bindingSurface: { variables: [], actions: store.actions } }),
  bindAttribute: store.bindAttribute,
  unbindAttribute: store.unbindAttribute,
  addBindAction: store.addBindAction,
}));

const FIELD = {
  label: 'Mouse Down',
  componentId: 'ui::events',
  path: 'onMouseDown',
  kind: 'callback',
} as FieldConfig;

function renderField(bound?: string) {
  render(
    <CallbackField
      field={FIELD}
      entity={7 as never}
      bound={bound}
    />,
  );
  return { trigger: screen.getByLabelText('Mouse Down') };
}

const options = () => [...document.querySelectorAll('[role="option"]')];

const optionNamed = (text: string) => options().find(o => o.textContent === text) as HTMLElement;

beforeEach(() => {
  store.bindAttribute.mockClear();
  store.unbindAttribute.mockClear();
  store.addBindAction.mockClear();
  store.actions = [{ name: 'onPress' }, { name: 'onRelease' }];
});

describe('when nothing is bound to the event', () => {
  it('should read the placeholder and offer no clear button', () => {
    const { trigger } = renderField();

    expect(trigger.textContent).toBe('Bind an event handler');
    expect(screen.queryByLabelText('Clear Mouse Down')).toBeNull();
  });
});

describe('when a handler is bound', () => {
  it('should read the handler name', () => {
    const { trigger } = renderField('onPress');

    expect(trigger.textContent).toBe('onPress');
  });

  it('should clear the binding from the trash button', () => {
    renderField('onPress');

    fireEvent.click(screen.getByLabelText('Clear Mouse Down'));

    expect(store.unbindAttribute).toHaveBeenCalledWith(7, 'onMouseDown');
  });
});

describe('when the menu is open', () => {
  it('should list None first, then every declared action', () => {
    const { trigger } = renderField();
    fireEvent.click(trigger);

    expect(options().map(o => o.textContent)).toEqual(['None', 'onPress()', 'onRelease()']);
  });

  it('should mark the bound handler as the selected option', () => {
    const { trigger } = renderField('onRelease');
    fireEvent.click(trigger);

    const selected = options().filter(o => o.getAttribute('aria-selected') === 'true');
    expect(selected.map(o => o.textContent)).toEqual(['onRelease()']);
  });

  it('should bind the picked handler through a thunk', () => {
    const { trigger } = renderField();
    fireEvent.click(trigger);

    fireEvent.click(optionNamed('onPress()'));

    expect(store.bindAttribute).toHaveBeenCalledWith(
      7,
      'onMouseDown',
      '() => onPress({ state, props })',
    );
  });

  it('should unbind when None is picked', () => {
    const { trigger } = renderField('onPress');
    fireEvent.click(trigger);

    fireEvent.click(optionNamed('None'));

    expect(store.unbindAttribute).toHaveBeenCalledWith(7, 'onMouseDown');
    expect(store.bindAttribute).not.toHaveBeenCalled();
  });

  it('should still offer a handler that is already bound', () => {
    const { trigger } = renderField('onPress');
    fireEvent.click(trigger);

    expect(optionNamed('onPress()')).toBeTruthy();
  });
});

describe('when adding an action from inside the menu', () => {
  const openAdd = () => {
    const { trigger } = renderField();
    fireEvent.click(trigger);
    fireEvent.click(screen.getByText('Add New Event'));
    return screen.getByLabelText('Description');
  };

  it('should seed the name from the event and declare it, then bind it', async () => {
    const input = openAdd();
    expect((input as HTMLInputElement).value).toBe('onMouseDown');

    fireEvent.click(screen.getByText('ADD'));

    await vi.waitFor(() => expect(store.addBindAction).toHaveBeenCalledWith('onMouseDown'));
    await vi.waitFor(() =>
      expect(store.bindAttribute).toHaveBeenCalledWith(
        7,
        'onMouseDown',
        '() => onMouseDown({ state, props })',
      ),
    );
  });

  it('should refuse a name that is not a valid identifier', () => {
    const input = openAdd();

    fireEvent.change(input, { target: { value: '2fast' } });
    fireEvent.click(screen.getByText('ADD'));

    expect(store.addBindAction).not.toHaveBeenCalled();
    expect(screen.getByText(/not a valid name/i)).toBeTruthy();
  });

  it('should refuse a name already taken by another action', () => {
    const input = openAdd();

    fireEvent.change(input, { target: { value: 'onRelease' } });
    fireEvent.click(screen.getByText('ADD'));

    expect(store.addBindAction).not.toHaveBeenCalled();
    expect(screen.getByText(/already in use/i)).toBeTruthy();
  });
});

describe('when building the thunk spliced into source', () => {
  const field = (componentId: string, path: string) =>
    ({ label: path, componentId, path, kind: 'callback' }) as never;

  it('should take no argument for a mouse event, which react-ecs calls with none', () => {
    expect(thunkExprFor(field('ui::events', 'onMouseDown'), 'onClick')).toBe(
      '() => onClick({ state, props })',
    );
  });

  it('should carry an unknown-typed value for the events that deliver one', () => {
    expect(thunkExprFor(field('core::UiInput', 'onChange'), 'onType')).toBe(
      '(value: unknown) => onType({ state, props, value })',
    );
    expect(thunkExprFor(field('core::UiDropdown', 'onChange'), 'onPick')).toBe(
      '(value: unknown) => onPick({ state, props, value })',
    );
  });

  it('should make the param optional for a callback prop, matching its declared type', () => {
    expect(thunkExprFor(field('ui::props', 'onSave'), 'onSave')).toBe(
      '(value?: unknown) => onSave({ state, props, value })',
    );
  });
});
