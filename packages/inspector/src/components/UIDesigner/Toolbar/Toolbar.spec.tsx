import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';

import { setSceneRunIntent, togglePanel } from '../../../redux/ui';
import { PanelName, UIDesignerTool } from '../../../redux/ui/types';
import { Tools } from './Tools';
import UIDesignerToolbar from './UIDesignerToolbar';

const STOP = 'Stop and reset scene to its initial state';
const LEAVE_2D = togglePanel({ panel: PanelName.UI_DESIGNER, enabled: false });

const mocks = vi.hoisted(() => ({
  tool: 'free' as string,
  sceneRunning: false,
  sceneRunStarted: false,
  sceneInfo: true,
  sceneInfoPanelVisible: false,
  dispatch: vi.fn(),
  updateUIState: vi.fn(),
  sdk: {
    renderer: { sceneRun: { setRunning: vi.fn(), reset: vi.fn() } },
    engine: { RootEntity: 0 },
    operations: { updateSelectedEntity: vi.fn(), dispatch: vi.fn() },
  },
}));

vi.mock('../../../redux/hooks', () => ({
  useAppSelector: (selector: (state: unknown) => unknown) =>
    selector({
      ui: {
        uiDesignerTool: mocks.tool,
        uiDesignerSnapEnabled: true,
        sceneRunIntent: mocks.sceneRunning,
        sceneRunStarted: mocks.sceneRunStarted,
      },
      dataLayer: { sceneInfo: { content: mocks.sceneInfo ? 'Scene info' : '' } },
    }),
  useAppDispatch: () => mocks.dispatch,
}));

vi.mock('../../../hooks/sdk/useSdk', () => ({ useSdk: () => mocks.sdk }));

vi.mock('../../../hooks/sdk/useInspectorUIState', () => ({
  useInspectorUIState: () => [
    { sceneInfoPanelVisible: mocks.sceneInfoPanelVisible },
    mocks.updateUIState,
  ],
}));

vi.mock('../code/store', () => ({
  redoCode: vi.fn(),
  undoCode: vi.fn(),
  useCodeState: () => ({ canUndo: true, canRedo: false }),
}));

vi.mock('../../../lib/rpc/scene', () => ({ getSceneClient: () => null }));

const button = (name: string) => screen.getByRole('button', { name });
const pressed = (name: string) => button(name).getAttribute('aria-pressed');
const disabled = (name: string) => (button(name) as HTMLButtonElement).disabled;

describe('UI Designer tools', () => {
  beforeEach(() => {
    mocks.tool = UIDesignerTool.MOVE;
  });

  describe('when the move tool is selected', () => {
    it('should mark only the move gizmo as pressed', () => {
      render(<Tools />);
      expect(pressed('Move')).toBe('true');
      expect(pressed('Free — move and resize')).toBe('false');
      expect(pressed('Resize')).toBe('false');
    });
  });

  describe('when rendered', () => {
    it('should offer no snap control', () => {
      render(<Tools />);
      for (const name of ['Snap', 'Snap options', 'Snap increments']) {
        expect(screen.queryByRole('button', { name })).toBeNull();
      }
    });
  });
});

describe('UI Designer toolbar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.tool = UIDesignerTool.FREE;
    mocks.sceneRunning = false;
    mocks.sceneRunStarted = false;
    mocks.sceneInfo = true;
    mocks.sceneInfoPanelVisible = false;
  });

  describe('run controls', () => {
    describe('when stopped', () => {
      it('should offer Play and a disabled Pause', () => {
        render(<UIDesignerToolbar />);
        expect(disabled('Run scene')).toBe(false);
        expect(disabled('Pause scene')).toBe(true);
      });

      it('should leave 2D and run when Play is clicked', () => {
        render(<UIDesignerToolbar />);
        fireEvent.click(button('Run scene'));
        expect(mocks.dispatch).toHaveBeenCalledWith(setSceneRunIntent({ running: true }));
        expect(mocks.dispatch).toHaveBeenCalledWith(LEAVE_2D);
        expect(mocks.sdk.renderer.sceneRun.setRunning).toHaveBeenCalledWith(true);
      });
    });

    describe('when the intent is running', () => {
      beforeEach(() => {
        mocks.sceneRunStarted = true;
        mocks.sceneRunning = true;
      });

      it('should offer Stop and an unpressed Pause that pauses in place', () => {
        render(<UIDesignerToolbar />);
        expect(button(STOP)).toBeTruthy();
        expect(pressed('Pause scene')).toBe('false');
        fireEvent.click(button('Pause scene'));
        expect(mocks.dispatch).toHaveBeenCalledWith(setSceneRunIntent({ running: false }));
        expect(mocks.dispatch).not.toHaveBeenCalledWith(LEAVE_2D);
      });
    });

    describe('when paused', () => {
      beforeEach(() => {
        mocks.sceneRunStarted = true;
        mocks.sceneRunning = false;
      });

      it('should press Pause and resume through the Play path', () => {
        render(<UIDesignerToolbar />);
        expect(pressed('Pause scene')).toBe('true');
        expect(button('Pause scene').title).toBe('Resume scene');
        fireEvent.click(button('Pause scene'));
        expect(mocks.dispatch).toHaveBeenCalledWith(setSceneRunIntent({ running: true }));
        expect(mocks.dispatch).toHaveBeenCalledWith(LEAVE_2D);
        expect(mocks.sdk.renderer.sceneRun.setRunning).toHaveBeenCalledWith(true);
      });

      it('should reset when Stop is clicked', () => {
        render(<UIDesignerToolbar />);
        fireEvent.click(button(STOP));
        expect(mocks.dispatch).toHaveBeenCalledWith(
          setSceneRunIntent({ running: false, reset: true }),
        );
        expect(mocks.sdk.renderer.sceneRun.reset).toHaveBeenCalled();
      });
    });
  });

  describe('when Edit Scene is clicked', () => {
    it('should leave 2D and select the scene root', () => {
      render(<UIDesignerToolbar />);
      fireEvent.click(button('Edit Scene'));
      expect(mocks.dispatch).toHaveBeenCalledWith(LEAVE_2D);
      expect(mocks.sdk.operations.updateSelectedEntity).toHaveBeenCalledWith(0, false);
      expect(mocks.sdk.operations.dispatch).toHaveBeenCalled();
    });
  });

  describe('More options', () => {
    it('should list Scene Info only and toggle its panel', () => {
      render(<UIDesignerToolbar />);
      fireEvent.click(screen.getByRole('combobox', { name: 'More options' }));
      const items = within(screen.getByRole('listbox')).getAllByRole('option');
      expect(items.map(item => item.textContent)).toEqual(['Scene Info']);
      expect(items[0].getAttribute('aria-selected')).toBe('false');
      fireEvent.click(items[0]);
      expect(mocks.updateUIState).toHaveBeenCalledWith({ sceneInfoPanelVisible: true });
    });

    it('should be absent when the scene has no scene info', () => {
      mocks.sceneInfo = false;
      render(<UIDesignerToolbar />);
      expect(screen.queryByRole('combobox', { name: 'More options' })).toBeNull();
    });
  });

  describe('when rendered', () => {
    it('should have no Save', () => {
      render(<UIDesignerToolbar />);
      expect(screen.queryByRole('button', { name: 'Save changes' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'All changes saved' })).toBeNull();
    });
  });
});
