import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

import type * as AnalyticsModule from '../../../../lib/logic/analytics';
import { Event } from '../../../../lib/logic/analytics';
import { CodeVariablesPanel } from './CodeVariablesPanel';
import { CodePropsPanel } from './CodePropsPanel';
import { CodeCallbacksPanel } from './CodeCallbacksPanel';

const mocks = vi.hoisted(() => ({ track: vi.fn() }));

vi.mock('../../../../lib/logic/analytics', async importActual => ({
  ...(await importActual<typeof AnalyticsModule>()),
  analytics: { track: mocks.track },
}));

vi.mock('../../code/store', () => ({
  useCodeState: () => ({
    filename: 'src/ui/MainUI.tsx',
    bindingSurface: { variables: [] },
    actions: [],
  }),
  addBindVariable: vi.fn(),
  removeStateVariable: vi.fn(),
  retypeStateVariable: vi.fn(),
  setStateVariableValue: vi.fn(),
  addBindProp: vi.fn(),
  removeProp: vi.fn(),
  retypeProp: vi.fn(),
  addBindAction: vi.fn(),
  removeAction: vi.fn(),
  setActionBody: vi.fn(),
}));

beforeEach(() => {
  vi.useFakeTimers();
  mocks.track.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

function addNamed(nameLabel: string, addLabel: string) {
  fireEvent.change(screen.getByLabelText(nameLabel), { target: { value: 'score' } });
  act(() => {
    vi.advanceTimersByTime(1);
  });
  fireEvent.click(screen.getByLabelText(addLabel));
}

describe('when adding through a Logic panel', () => {
  it('should track a variable add', () => {
    render(<CodeVariablesPanel />);
    addNamed('New variable name', 'Add variable');

    expect(mocks.track).toHaveBeenCalledWith(Event.ADD_UI_LOGIC, { logicType: 'variable' });
  });

  it('should track an input add', () => {
    render(<CodePropsPanel />);
    addNamed('New input name', 'Add input');

    expect(mocks.track).toHaveBeenCalledWith(Event.ADD_UI_LOGIC, { logicType: 'input' });
  });

  it('should track an event add', () => {
    render(<CodeCallbacksPanel />);
    addNamed('New action name', 'Add event');

    expect(mocks.track).toHaveBeenCalledWith(Event.ADD_UI_LOGIC, { logicType: 'event' });
  });
});
