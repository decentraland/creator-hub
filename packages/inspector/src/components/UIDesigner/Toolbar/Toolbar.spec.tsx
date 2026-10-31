import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { UIDesignerTool } from '../../../redux/ui/types';
import { Tools } from './Tools';
import UIDesignerToolbar from './UIDesignerToolbar';

const mocks = vi.hoisted(() => ({
  tool: 'free' as string,
  sceneRunning: false,
  sceneInfoPanelVisible: false,
}));

vi.mock('../../../redux/hooks', () => ({
  useAppSelector: (selector: (state: unknown) => unknown) =>
    selector({
      ui: {
        uiDesignerTool: mocks.tool,
        uiDesignerSnapEnabled: true,
        sceneRunIntent: mocks.sceneRunning,
      },
      dataLayer: { sceneInfo: { content: 'Scene info' } },
    }),
  useAppDispatch: () => vi.fn(),
}));

vi.mock('../../../hooks/sdk/useSdk', () => ({
  useSdk: () => ({ renderer: { sceneRun: { setRunning: vi.fn(), reset: vi.fn() } } }),
}));

vi.mock('../../../hooks/sdk/useInspectorUIState', () => ({
  useInspectorUIState: () => [{ sceneInfoPanelVisible: mocks.sceneInfoPanelVisible }, vi.fn()],
}));

vi.mock('../code/store', () => ({
  redoCode: vi.fn(),
  undoCode: vi.fn(),
  useCodeState: () => ({ canUndo: true, canRedo: false }),
}));

vi.mock('../../../lib/rpc/scene', () => ({ getSceneClient: () => null }));

const pressed = (name: string) => screen.getByRole('button', { name }).getAttribute('aria-pressed');

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

  describe('when the snap caret is clicked', () => {
    it('should be a named button that reports the panel as expanded', () => {
      render(<Tools />);
      const caret = screen.getByRole('button', { name: 'Snap options' });
      expect(caret.getAttribute('aria-expanded')).toBe('false');
      fireEvent.click(caret);
      expect(caret.getAttribute('aria-expanded')).toBe('true');
    });
  });
});

describe('UI Designer toolbar', () => {
  beforeEach(() => {
    mocks.tool = UIDesignerTool.FREE;
    mocks.sceneRunning = false;
    mocks.sceneInfoPanelVisible = false;
  });

  describe('when the scene is stopped and the info panel closed', () => {
    it('should render run and scene info unpressed', () => {
      render(<UIDesignerToolbar />);
      expect(pressed('Run scene')).toBe('false');
      expect(pressed('Scene Info')).toBe('false');
    });
  });

  describe('when the scene runs and the info panel is open', () => {
    beforeEach(() => {
      mocks.sceneRunning = true;
      mocks.sceneInfoPanelVisible = true;
    });

    it('should render run and scene info pressed', () => {
      render(<UIDesignerToolbar />);
      expect(pressed('Run scene')).toBe('true');
      expect(pressed('Scene Info')).toBe('true');
    });
  });
});
