import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { PanelName } from '../../redux/ui/types';
import type * as AnalyticsModule from '../../lib/logic/analytics';
import { Event } from '../../lib/logic/analytics';
import { ModeSwitcher } from './ModeSwitcher';

const mocks = vi.hoisted(() => ({
  dispatch: vi.fn(),
  setUiDesignerMode: vi.fn(),
  track: vi.fn(),
  hiddenPanels: {} as Record<string, boolean>,
  uiEditorEnabled: true,
}));

vi.mock('../../lib/logic/analytics', async importActual => ({
  ...(await importActual<typeof AnalyticsModule>()),
  analytics: { track: mocks.track },
}));

vi.mock('../../lib/rpc/scene', () => ({
  getSceneClient: () => ({ setUiDesignerMode: mocks.setUiDesignerMode }),
}));

vi.mock('../../lib/logic/config', () => ({
  getConfig: () => ({ uiEditorEnabled: mocks.uiEditorEnabled }),
}));

vi.mock('../../redux/hooks', () => ({
  useAppDispatch: () => mocks.dispatch,
  useAppSelector: (selector: (s: unknown) => unknown) =>
    selector({ ui: { hiddenPanels: mocks.hiddenPanels } }),
}));

beforeEach(() => {
  mocks.dispatch.mockClear();
  mocks.setUiDesignerMode.mockClear();
  mocks.track.mockClear();
  mocks.hiddenPanels = { [PanelName.UI_DESIGNER]: true };
  mocks.uiEditorEnabled = true;
});

afterEach(() => {
  cleanup();
});

const tabs = () => ({
  twoD: screen.getByRole('tab', { name: '2D' }),
  threeD: screen.getByRole('tab', { name: '3D' }),
});

describe('when the GUI Editor feature is disabled', () => {
  it('should render nothing', () => {
    mocks.uiEditorEnabled = false;
    const { container } = render(<ModeSwitcher />);

    expect(container.firstChild).toBeNull();
    expect(screen.queryByRole('tab', { name: '2D' })).toBeNull();
  });
});

describe('when reflecting the current mode', () => {
  it('should select 3D when the designer is hidden', () => {
    render(<ModeSwitcher />);

    expect(tabs().threeD.getAttribute('aria-selected')).toBe('true');
    expect(tabs().twoD.getAttribute('aria-selected')).toBe('false');
  });

  it('should select 2D when the designer is open', () => {
    mocks.hiddenPanels = { [PanelName.UI_DESIGNER]: false };
    render(<ModeSwitcher />);

    expect(tabs().twoD.getAttribute('aria-selected')).toBe('true');
  });
});

describe('when a mode is picked', () => {
  it('should open the designer and persist that for the next session', () => {
    render(<ModeSwitcher />);

    fireEvent.click(tabs().twoD);

    expect(mocks.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ payload: { panel: PanelName.UI_DESIGNER, enabled: true } }),
    );
    expect(mocks.setUiDesignerMode).toHaveBeenCalledWith(true);
  });

  it('should track opening the UI editor only on a real switch into 2D', () => {
    render(<ModeSwitcher />);

    fireEvent.click(tabs().twoD);

    expect(mocks.track).toHaveBeenCalledWith(Event.OPEN_UI_EDITOR, {});
    expect(mocks.track).toHaveBeenCalledTimes(1);
  });

  it('should not track when already in 2D or when switching to 3D', () => {
    mocks.hiddenPanels = { [PanelName.UI_DESIGNER]: false };
    render(<ModeSwitcher />);

    fireEvent.click(tabs().twoD);
    fireEvent.click(tabs().threeD);

    expect(mocks.track).not.toHaveBeenCalled();
  });

  it('should close the designer again', () => {
    mocks.hiddenPanels = { [PanelName.UI_DESIGNER]: false };
    render(<ModeSwitcher />);

    fireEvent.click(tabs().threeD);

    expect(mocks.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ payload: { panel: PanelName.UI_DESIGNER, enabled: false } }),
    );
    expect(mocks.setUiDesignerMode).toHaveBeenCalledWith(false);
  });

  it('should persist a re-pick without dispatching a redundant toggle', () => {
    render(<ModeSwitcher />);

    fireEvent.click(tabs().threeD);

    expect(mocks.dispatch).not.toHaveBeenCalled();
    expect(mocks.setUiDesignerMode).toHaveBeenCalledWith(false);
  });
});
