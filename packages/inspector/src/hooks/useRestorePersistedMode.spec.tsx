import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render } from '@testing-library/react';

import { PanelName } from '../redux/ui/types';
import { useRestorePersistedMode } from './useRestorePersistedMode';

const mocks = vi.hoisted(() => ({
  dispatch: vi.fn(),
  hiddenPanels: {} as Record<string, boolean>,
  config: { uiDesignerOpen: false, uiEditorEnabled: true },
}));

vi.mock('../lib/logic/config', () => ({
  getConfig: () => mocks.config,
}));

vi.mock('../redux/hooks', () => ({
  useAppDispatch: () => mocks.dispatch,
  useAppSelector: (selector: (s: unknown) => unknown) =>
    selector({ ui: { hiddenPanels: mocks.hiddenPanels } }),
}));

const Probe = () => {
  useRestorePersistedMode();
  return null;
};

beforeEach(() => {
  mocks.dispatch.mockClear();
  mocks.hiddenPanels = { [PanelName.UI_DESIGNER]: true };
  mocks.config = { uiDesignerOpen: false, uiEditorEnabled: true };
});

afterEach(() => {
  cleanup();
});

describe('useRestorePersistedMode', () => {
  it('should open the designer when the scene was last left in 2D', () => {
    mocks.config = { uiDesignerOpen: true, uiEditorEnabled: true };
    render(<Probe />);

    expect(mocks.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ payload: { panel: PanelName.UI_DESIGNER, enabled: true } }),
    );
  });

  it('should not touch the panel when the scene was last left in 3D', () => {
    mocks.config = { uiDesignerOpen: false, uiEditorEnabled: true };
    render(<Probe />);

    expect(mocks.dispatch).not.toHaveBeenCalled();
  });

  it('should not restore 2D when the UI Editor flag is off', () => {
    mocks.config = { uiDesignerOpen: true, uiEditorEnabled: false };
    render(<Probe />);

    expect(mocks.dispatch).not.toHaveBeenCalled();
  });

  it('should not re-dispatch when already in the persisted mode', () => {
    mocks.hiddenPanels = { [PanelName.UI_DESIGNER]: false };
    mocks.config = { uiDesignerOpen: true, uiEditorEnabled: true };
    render(<Probe />);

    expect(mocks.dispatch).not.toHaveBeenCalled();
  });
});
