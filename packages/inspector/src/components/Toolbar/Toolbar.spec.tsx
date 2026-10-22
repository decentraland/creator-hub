import React, { useEffect, useState } from 'react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import uiReducer from '../../redux/ui';
import { GizmoType } from '../../lib/utils/gizmo';
import Toolbar from './Toolbar';

const STOP = 'Stop and reset scene to its initial state';

const mocks = vi.hoisted(() => ({ sdk: null as unknown }));

vi.mock('../../hooks/sdk/useSdk', () => ({
  useSdk: (cb?: (sdk: unknown) => (() => void) | void) => {
    useEffect(() => cb?.(mocks.sdk), []);
    return mocks.sdk;
  },
}));

vi.mock('../../hooks/sdk/useInspectorUIState', () => ({
  useInspectorUIState: () => {
    const [state, setState] = useState({ sceneInfoPanelVisible: false });
    return [state, (patch: object) => setState(prev => ({ ...prev, ...patch }))];
  },
}));

vi.mock('../../hooks/sdk/useSelectedEntity', () => ({ useSelectedEntity: () => 512 }));

vi.mock('../../hooks/sdk/useComponentValue', () => ({
  useComponentValue: () => useState({ gizmo: GizmoType.FREE }),
}));

function createSwitch(initial: boolean) {
  let value = initial;
  const listeners = new Set<(next: boolean) => void>();
  const set = vi.fn((next: boolean) => {
    value = next;
    listeners.forEach(listener => listener(next));
  });
  const get = () => value;
  const subscribe = (listener: (next: boolean) => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };
  return { get, set, subscribe };
}

function createSdk() {
  const run = createSwitch(false);
  const editing = createSwitch(true);
  const mute = createSwitch(false);
  const noop = () => () => {};
  return {
    renderer: {
      sceneRun: {
        isRunning: run.get,
        setRunning: run.set,
        onRunChange: run.subscribe,
        reset: vi.fn(async () => run.set(false)),
      },
      interaction: {
        isEditingEnabled: editing.get,
        setEditingEnabled: editing.set,
        onEditingChange: editing.subscribe,
      },
      audio: { isMuted: mute.get, setMuted: mute.set, onMuteChange: mute.subscribe },
      spawnPoints: { getSelectedIndex: () => null, onSelectionChange: noop },
      gizmos: {
        isWorldAligned: () => false,
        isWorldAlignmentDisabled: () => false,
        setWorldAligned: vi.fn(),
        onChange: noop,
      },
      debug: { toggle: vi.fn() },
      camera: { setInvertRotation: vi.fn() },
    },
    components: { Selection: {} },
    engine: { RootEntity: 0 },
    operations: { updateSelectedEntity: vi.fn(), dispatch: vi.fn() },
  };
}

function renderToolbar() {
  const store = configureStore({
    reducer: {
      ui: uiReducer,
      app: () => ({ canSave: false, preferences: { autosaveEnabled: true } }),
      dataLayer: () => ({
        undoRedoState: { canUndo: true, canRedo: false },
        sceneInfo: { content: 'Scene info' },
      }),
    },
  });
  const view = render(
    <Provider store={store}>
      <Toolbar />
    </Provider>,
  );
  return { ...view, store };
}

const button = (name: string) => screen.getByRole('button', { name });
const pressed = (name: string) => button(name).getAttribute('aria-pressed');
const sdk = () => mocks.sdk as ReturnType<typeof createSdk>;

describe('3D toolbar', () => {
  beforeEach(() => {
    mocks.sdk = createSdk();
  });

  describe('when tabbing through the toolbar', () => {
    it('should focus every enabled button in order', () => {
      const { container } = renderToolbar();
      const order = Array.from(container.querySelectorAll('button'))
        .filter(el => !el.disabled)
        .map(el => el.getAttribute('aria-label') ?? el.title);
      expect(order).toEqual([
        'Undo',
        'Free movement tool',
        'Translation tool',
        'Rotation tool',
        'Scaling tool',
        'Snap options',
        'Interact with the scene',
        'Mute scene audio',
        'Preferences',
        'Inspector',
        'Run scene',
        'Edit Scene',
        'Scene Info',
      ]);
    });
  });

  describe('when the snap caret is activated', () => {
    it('should name the snap caret and expose its state', () => {
      renderToolbar();
      const caret = button('Snap options');
      expect(caret.getAttribute('aria-expanded')).toBe('false');
      fireEvent.click(caret);
      expect(caret.getAttribute('aria-expanded')).toBe('true');
      expect(caret.nextElementSibling?.querySelector('input')).not.toBeNull();
    });
  });

  describe('when a gizmo is clicked', () => {
    it('should expose the selected gizmo as pressed', () => {
      renderToolbar();
      expect(pressed('Free movement tool')).toBe('true');
      expect(pressed('Translation tool')).toBe('false');
      fireEvent.click(button('Translation tool'));
      expect(pressed('Translation tool')).toBe('true');
      expect(pressed('Free movement tool')).toBe('false');
    });
  });

  describe('run controls', () => {
    describe('when stopped', () => {
      it('should offer Run and a disabled Pause', () => {
        renderToolbar();
        expect((button('Run scene') as HTMLButtonElement).disabled).toBe(false);
        expect((button('Pause scene') as HTMLButtonElement).disabled).toBe(true);
        expect(pressed('Pause scene')).toBe('false');
      });
    });

    describe('when Run is clicked', () => {
      it('should run and swap slot 1 to Stop, keeping focus on it', () => {
        renderToolbar();
        const slot = button('Run scene');
        slot.focus();
        fireEvent.click(slot);
        expect(sdk().renderer.sceneRun.setRunning).toHaveBeenCalledWith(true);
        expect(button(STOP)).toBe(slot);
        expect(document.activeElement).toBe(slot);
        expect((button('Pause scene') as HTMLButtonElement).disabled).toBe(false);
        expect(pressed('Pause scene')).toBe('false');
      });
    });

    describe('when Pause is clicked while running', () => {
      it('should pause and press Pause', () => {
        renderToolbar();
        fireEvent.click(button('Run scene'));
        fireEvent.click(button('Pause scene'));
        expect(sdk().renderer.sceneRun.setRunning).toHaveBeenLastCalledWith(false);
        expect(pressed('Pause scene')).toBe('true');
        expect(button('Pause scene').title).toBe('Resume scene');
        expect(button(STOP)).toBeTruthy();
      });
    });

    describe('when Pause is clicked while paused', () => {
      it('should resume', () => {
        renderToolbar();
        fireEvent.click(button('Run scene'));
        fireEvent.click(button('Pause scene'));
        fireEvent.click(button('Pause scene'));
        expect(sdk().renderer.sceneRun.setRunning).toHaveBeenLastCalledWith(true);
        expect(pressed('Pause scene')).toBe('false');
        expect(button('Pause scene').title).toBe('Pause scene');
      });
    });

    describe('when Stop is clicked', () => {
      it('should reset and return to stopped', () => {
        const { store } = renderToolbar();
        fireEvent.click(button('Run scene'));
        fireEvent.click(button(STOP));
        expect(sdk().renderer.sceneRun.reset).toHaveBeenCalled();
        expect(store.getState().ui.sceneRunStarted).toBe(false);
        expect(button('Run scene')).toBeTruthy();
        expect((button('Pause scene') as HTMLButtonElement).disabled).toBe(true);
      });
    });
  });

  describe.each([
    ['Interact with the scene', () => sdk().renderer.interaction.setEditingEnabled],
    ['Mute scene audio', () => sdk().renderer.audio.setMuted],
  ])('when the %s toggle is clicked', (name, setter) => {
    it('should keep its name and flip aria-pressed', () => {
      renderToolbar();
      expect(pressed(name)).toBe('false');
      fireEvent.click(button(name));
      expect(setter()).toHaveBeenCalled();
      expect(pressed(name)).toBe('true');
    });
  });

  describe('when Scene Info is clicked', () => {
    it('should keep its name and flip aria-pressed', () => {
      renderToolbar();
      expect(pressed('Scene Info')).toBe('false');
      fireEvent.click(button('Scene Info'));
      expect(pressed('Scene Info')).toBe('true');
    });
  });
});
