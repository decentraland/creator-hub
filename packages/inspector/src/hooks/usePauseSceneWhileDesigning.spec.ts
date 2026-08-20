import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

import { PanelName } from '../redux/ui/types';
import { usePauseSceneWhileDesigning } from './usePauseSceneWhileDesigning';

const mocks = vi.hoisted(() => ({
  hiddenPanels: {} as Record<string, boolean>,
  sceneRun: null as { isRunning: () => boolean; setRunning: (running: boolean) => void } | null,
  setRunning: vi.fn(),
  running: false,
}));

vi.mock('../redux/hooks', () => ({
  useAppSelector: (selector: (s: unknown) => unknown) =>
    selector({ ui: { hiddenPanels: mocks.hiddenPanels } }),
}));

vi.mock('./sdk/useSdk', () => ({
  useSdk: () => ({ renderer: { sceneRun: mocks.sceneRun } }),
}));

beforeEach(() => {
  mocks.setRunning.mockClear();
  mocks.running = false;
  mocks.sceneRun = {
    isRunning: () => mocks.running,
    setRunning: mocks.setRunning,
  };
  mocks.hiddenPanels = { [PanelName.UI_DESIGNER]: true };
});

describe('when the UI Designer opens', () => {
  it('should pause a running scene', () => {
    mocks.running = true;
    mocks.hiddenPanels = { [PanelName.UI_DESIGNER]: false };

    renderHook(() => usePauseSceneWhileDesigning());

    expect(mocks.setRunning).toHaveBeenCalledWith(false);
  });

  it('should leave an already paused scene alone', () => {
    mocks.hiddenPanels = { [PanelName.UI_DESIGNER]: false };

    renderHook(() => usePauseSceneWhileDesigning());

    expect(mocks.setRunning).not.toHaveBeenCalled();
  });

  it('should not throw on a renderer without a run state', () => {
    mocks.sceneRun = null;
    mocks.hiddenPanels = { [PanelName.UI_DESIGNER]: false };

    expect(() => renderHook(() => usePauseSceneWhileDesigning())).not.toThrow();
  });
});

describe('when the 3D viewport is showing', () => {
  it('should not touch the run state', () => {
    mocks.running = true;

    renderHook(() => usePauseSceneWhileDesigning());

    expect(mocks.setRunning).not.toHaveBeenCalled();
  });

  it('should not resume the scene it paused on the way in', () => {
    mocks.running = true;
    mocks.hiddenPanels = { [PanelName.UI_DESIGNER]: false };
    const { rerender } = renderHook(() => usePauseSceneWhileDesigning());
    mocks.running = false;
    mocks.hiddenPanels = { [PanelName.UI_DESIGNER]: true };

    rerender();

    expect(mocks.setRunning).toHaveBeenCalledTimes(1);
    expect(mocks.setRunning).toHaveBeenCalledWith(false);
  });
});
