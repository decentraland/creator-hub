import React, { useEffect, useState } from 'react';
import { Provider } from 'react-redux';
import type { AnyAction, Middleware } from '@reduxjs/toolkit';
import { configureStore } from '@reduxjs/toolkit';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';

import type * as ConfigModule from '../../lib/logic/config';
import uiReducer from '../../redux/ui';
import { save, setInspectorPreferences } from '../../redux/data-layer';
import { snapManager } from '../../lib/babylon/decentraland/snap-manager';
import { GizmoType } from '../../lib/utils/gizmo';
import Toolbar from './Toolbar';

const STOP = 'Stop and reset scene to its initial state';

const mocks = vi.hoisted(() => ({ sdk: null as unknown, renderer: 'bevy' as string }));

vi.mock('../../lib/logic/config', async importOriginal => {
  const actual = await importOriginal<typeof ConfigModule>();
  return { ...actual, getConfig: () => ({ ...actual.getConfig(), renderer: mocks.renderer }) };
});

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

function createSwitch<T>(initial: T) {
  let value = initial;
  const listeners = new Set<(next: T) => void>();
  const set = vi.fn((next: T) => {
    value = next;
    listeners.forEach(listener => listener(next));
  });
  const get = () => value;
  const subscribe = (listener: (next: T) => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };
  return { get, set, subscribe };
}

type Renderer = 'bevy' | 'babylon';

function createSdk(renderer: Renderer) {
  const run = createSwitch(false);
  const editing = createSwitch(true);
  const mute = createSwitch(false);
  const camera = createSwitch<'free' | 'avatar'>('avatar');
  const aligned = createSwitch(false);
  const noop = () => () => {};
  const bevyOnly = renderer === 'bevy';
  return {
    renderer: {
      sceneRun: bevyOnly
        ? {
            isRunning: run.get,
            setRunning: run.set,
            onRunChange: run.subscribe,
            reset: vi.fn(async () => run.set(false)),
          }
        : undefined,
      interaction: bevyOnly
        ? {
            isEditingEnabled: editing.get,
            setEditingEnabled: editing.set,
            onEditingChange: editing.subscribe,
          }
        : undefined,
      audio: bevyOnly
        ? { isMuted: mute.get, setMuted: mute.set, onMuteChange: mute.subscribe }
        : undefined,
      editorCamera: bevyOnly
        ? { getMode: camera.get, setMode: camera.set, onModeChange: camera.subscribe }
        : undefined,
      spawnPoints: { getSelectedIndex: () => null, onSelectionChange: noop },
      gizmos: {
        isWorldAligned: aligned.get,
        isWorldAlignmentDisabled: () => false,
        setWorldAligned: aligned.set,
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

type Options = {
  renderer?: Renderer;
  autosaveEnabled?: boolean;
  canSave?: boolean;
  sceneInfo?: boolean;
};

function renderToolbar({
  renderer = 'bevy',
  autosaveEnabled = true,
  canSave = false,
  sceneInfo = true,
}: Options = {}) {
  mocks.sdk = createSdk(renderer);
  mocks.renderer = renderer;
  const actions: AnyAction[] = [];
  const record: Middleware = () => next => action => {
    actions.push(action as AnyAction);
    return next(action);
  };
  const store = configureStore({
    reducer: {
      ui: uiReducer,
      app: () => ({
        canSave,
        preferences: { autosaveEnabled, freeCameraInvertRotation: false },
      }),
      dataLayer: () => ({
        undoRedoState: { canUndo: true, canRedo: false },
        sceneInfo: { content: sceneInfo ? 'Scene info' : '' },
      }),
    },
    middleware: getDefault => getDefault().concat(record),
  });
  const view = render(
    <Provider store={store}>
      <Toolbar />
    </Provider>,
  );
  return { ...view, store, actions };
}

const button = (name: string) => screen.getByRole('button', { name });
const pressed = (name: string) => button(name).getAttribute('aria-pressed');
const sdk = () => mocks.sdk as ReturnType<typeof createSdk>;
const openMenu = (name: string) => fireEvent.click(screen.getByRole('combobox', { name }));
const menuItems = () =>
  within(screen.getByRole('listbox'))
    .getAllByRole('option')
    .map(option => option.textContent);
const option = (name: string) => screen.getByRole('option', { name });

describe('3D toolbar', () => {
  beforeEach(() => {
    snapManager.setEnabled(false);
  });

  describe('when tabbing through the toolbar', () => {
    it('should focus every enabled control in order', () => {
      snapManager.setEnabled(true);
      const { container } = renderToolbar({ autosaveEnabled: false });
      const order = Array.from(container.querySelectorAll<HTMLElement>('button, [role="combobox"]'))
        .filter(el => !(el as HTMLButtonElement).disabled && el.getAttribute('tabindex') !== '-1')
        .map(el => el.getAttribute('aria-label') ?? (el.title || el.textContent));
      expect(order).toEqual([
        'Undo',
        'Free movement tool',
        'Translation tool',
        'Rotation tool',
        'Scaling tool',
        'Snap',
        'Snap increments',
        'Player',
        'Interact with the scene',
        'Mute scene audio',
        'Run scene',
        'Edit Scene',
        'All changes saved',
        'More options',
      ]);
    });
  });

  describe('when a gizmo is clicked', () => {
    it('should expose the selected gizmo as pressed', () => {
      renderToolbar();
      expect(pressed('Free movement tool')).toBe('true');
      fireEvent.click(button('Translation tool'));
      expect(pressed('Translation tool')).toBe('true');
      expect(pressed('Free movement tool')).toBe('false');
    });
  });

  describe('snap toggles', () => {
    it('should toggle Snap through the snap manager', () => {
      renderToolbar();
      expect(pressed('Snap')).toBe('false');
      fireEvent.click(button('Snap'));
      expect(pressed('Snap')).toBe('true');
      expect(snapManager.isEnabled()).toBe(true);
    });

    it('should toggle Align to World from a checkbox in the snap menu', () => {
      renderToolbar();
      expect(screen.queryByRole('button', { name: /align to world/i })).toBeNull();
      fireEvent.click(button('Snap increments'));
      const align = screen.getByRole('checkbox', { name: 'Align to World' });
      expect((align as HTMLInputElement).checked).toBe(false);
      fireEvent.click(align);
      expect(sdk().renderer.gizmos.setWorldAligned).toHaveBeenCalledWith(true);
      expect(
        (screen.getByRole('checkbox', { name: 'Align to World' }) as HTMLInputElement).checked,
      ).toBe(true);
    });
  });

  describe('snap increments caret', () => {
    it.each([false, true])('should open the snap menu with Snap on = %s', snapOn => {
      snapManager.setEnabled(snapOn);
      const { container } = renderToolbar();
      const chevron = button('Snap increments');
      expect(chevron.getAttribute('aria-expanded')).toBe('false');
      fireEvent.click(chevron);
      expect(chevron.getAttribute('aria-expanded')).toBe('true');
      expect(container.querySelector('.Gizmos .panel.visible')).not.toBeNull();
    });

    it('should open a panel of labelled increment inputs', () => {
      snapManager.setEnabled(true);
      renderToolbar();
      const caret = button('Snap increments');
      expect(caret.getAttribute('aria-expanded')).toBe('false');
      fireEvent.click(caret);
      expect(caret.getAttribute('aria-expanded')).toBe('true');
      for (const label of ['Position', 'Rotation', 'Scale']) {
        expect(screen.getAllByLabelText(label)).toHaveLength(1);
        expect(screen.getByLabelText(label).tagName).toBe('INPUT');
      }
    });

    it('should close on Escape pressed on the caret itself', () => {
      snapManager.setEnabled(true);
      const { container } = renderToolbar();
      const caret = button('Snap increments');
      caret.focus();
      fireEvent.click(caret);
      fireEvent.keyDown(caret, { key: 'Escape' });
      expect(caret.getAttribute('aria-expanded')).toBe('false');
      expect(container.querySelector('.Gizmos .panel.visible')).toBeNull();
      expect(document.activeElement).toBe(caret);
    });

    it('should close on Escape and return focus to the caret', () => {
      snapManager.setEnabled(true);
      const { container } = renderToolbar();
      const caret = button('Snap increments');
      fireEvent.click(caret);
      const input = screen.getByLabelText('Position');
      input.focus();
      fireEvent.keyDown(input, { key: 'Escape' });
      expect(container.querySelector('.Gizmos .panel.visible')).toBeNull();
      expect(document.activeElement).toBe(caret);
    });
  });

  describe('when rendered under Bevy', () => {
    it('should order the left group as Snap, camera, Interact, Mute', () => {
      const { container } = renderToolbar();
      const left = container.querySelector('.LeftContent')!;
      const order = [
        container.querySelector('.snap-menu')!,
        container.querySelector('.camera-mode')!,
        button('Interact with the scene'),
        button('Mute scene audio'),
      ];
      for (const el of order) expect(left.contains(el)).toBe(true);
      for (let i = 1; i < order.length; i++) {
        expect(
          order[i - 1].compareDocumentPosition(order[i]) & Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
      }
      expect(left.lastElementChild).toBe(button('Mute scene audio'));
    });

    it('should swap the Mute glyph with its state', () => {
      renderToolbar();
      const glyph = () => button('Mute scene audio').querySelector('svg')!.getAttribute('viewBox');
      const unmuted = glyph();
      fireEvent.click(button('Mute scene audio'));
      expect(button('Mute scene audio').title).toBe('Unmute scene audio');
      expect(glyph()).not.toBe(unmuted);
    });

    it('should offer Invert Camera Rotation in the camera menu', () => {
      const { container, actions } = renderToolbar();
      fireEvent.click(container.querySelector('.camera-mode')!);
      expect(menuItems()).toEqual(['Free', 'Player', 'Invert Camera Rotation']);
      fireEvent.click(option('Invert Camera Rotation'));
      expect(actions).toContainEqual(setInspectorPreferences({ freeCameraInvertRotation: true }));
      expect(sdk().renderer.camera.setInvertRotation).toHaveBeenCalledWith(true);
    });

    it('should list only auto-save and Scene Info in More options', () => {
      renderToolbar();
      openMenu('More options');
      expect(menuItems()).toEqual(['Enable Autosave', 'Scene Info']);
      expect(option('Enable Autosave').getAttribute('aria-selected')).toBe('true');
      expect(option('Scene Info').getAttribute('aria-selected')).toBe('false');
    });
  });

  describe('when rendered under Babylon', () => {
    it('should add Invert Camera Rotation to More options', () => {
      const { actions } = renderToolbar({ renderer: 'babylon' });
      openMenu('More options');
      expect(menuItems()).toEqual([
        'Enable Autosave',
        'Scene Info',
        'Invert Camera Rotation',
        'Inspector',
      ]);
      fireEvent.click(option('Invert Camera Rotation'));
      expect(actions).toContainEqual(setInspectorPreferences({ freeCameraInvertRotation: true }));
      expect(sdk().renderer.camera.setInvertRotation).toHaveBeenCalledWith(true);
    });

    it('should have no Preferences button', () => {
      renderToolbar({ renderer: 'babylon' });
      expect(screen.queryByRole('button', { name: 'Preferences' })).toBeNull();
    });
  });

  describe('More options actions', () => {
    it('should toggle the auto-save preference', () => {
      const { actions } = renderToolbar();
      openMenu('More options');
      fireEvent.click(option('Enable Autosave'));
      expect(actions).toContainEqual(setInspectorPreferences({ autosaveEnabled: false }));
    });

    it('should toggle the Scene Info panel', () => {
      renderToolbar();
      openMenu('More options');
      fireEvent.click(option('Scene Info'));
      openMenu('More options');
      expect(option('Scene Info').getAttribute('aria-selected')).toBe('true');
    });

    it('should open the Babylon inspector', () => {
      renderToolbar({ renderer: 'babylon' });
      openMenu('More options');
      fireEvent.click(option('Inspector'));
      expect(sdk().renderer.debug.toggle).toHaveBeenCalled();
    });

    it('should omit Scene Info when the scene has none', () => {
      renderToolbar({ sceneInfo: false });
      openMenu('More options');
      expect(menuItems()).toEqual(['Enable Autosave']);
    });
  });

  describe('Save', () => {
    it('should be hidden while auto-save is on', () => {
      renderToolbar();
      expect(screen.queryByRole('button', { name: /save/i })).toBeNull();
    });

    it('should sit after Edit, enabled, while auto-save is off', () => {
      const { container } = renderToolbar({ autosaveEnabled: false });
      const save = button('All changes saved') as HTMLButtonElement;
      expect(save.disabled).toBe(false);
      expect(save.parentElement).toBe(container.querySelector('.RightContent'));
      expect(button('Edit Scene').nextElementSibling).toBe(save);
    });

    it('should save when there are changes', () => {
      const { actions } = renderToolbar({ autosaveEnabled: false, canSave: true });
      fireEvent.click(button('Save changes'));
      expect(actions).toContainEqual(save());
    });
  });

  describe('run controls', () => {
    describe('when stopped', () => {
      it('should offer Run and a disabled Pause', () => {
        renderToolbar();
        expect((button('Run scene') as HTMLButtonElement).disabled).toBe(false);
        expect((button('Pause scene') as HTMLButtonElement).disabled).toBe(true);
        expect(button('Pause scene').hasAttribute('aria-pressed')).toBe(false);
      });
    });

    describe('when Run is clicked', () => {
      it('should run and swap slot 1 to Stop, keeping focus on it', () => {
        renderToolbar();
        const slot = button('Run scene');
        slot.focus();
        fireEvent.click(slot);
        expect(sdk().renderer.sceneRun!.setRunning).toHaveBeenCalledWith(true);
        expect(button(STOP)).toBe(slot);
        expect(document.activeElement).toBe(slot);
        const pause = button('Pause scene');
        expect((pause as HTMLButtonElement).disabled).toBe(false);
        expect(pause.hasAttribute('aria-pressed')).toBe(false);
        expect(pause.classList.contains('running')).toBe(true);
      });
    });

    describe('when Pause is clicked while running', () => {
      it('should pause and rename Pause to Resume', () => {
        renderToolbar();
        fireEvent.click(button('Run scene'));
        fireEvent.click(button('Pause scene'));
        expect(sdk().renderer.sceneRun!.setRunning).toHaveBeenLastCalledWith(false);
        const resume = button('Resume scene');
        expect(resume.title).toBe('Resume scene');
        expect(resume.hasAttribute('aria-pressed')).toBe(false);
        expect(resume.classList.contains('running')).toBe(false);
        expect(button(STOP)).toBeTruthy();
      });
    });

    describe('when Pause is clicked while paused', () => {
      it('should resume', () => {
        renderToolbar();
        fireEvent.click(button('Run scene'));
        fireEvent.click(button('Pause scene'));
        fireEvent.click(button('Resume scene'));
        expect(sdk().renderer.sceneRun!.setRunning).toHaveBeenLastCalledWith(true);
        expect(button('Pause scene').title).toBe('Pause scene');
        expect(button('Pause scene').classList.contains('running')).toBe(true);
      });
    });

    describe('when Stop is clicked', () => {
      it('should reset and return to stopped', () => {
        const { store } = renderToolbar();
        fireEvent.click(button('Run scene'));
        fireEvent.click(button(STOP));
        expect(sdk().renderer.sceneRun!.reset).toHaveBeenCalled();
        expect(store.getState().ui.sceneRunStarted).toBe(false);
        expect(button('Run scene')).toBeTruthy();
        expect((button('Pause scene') as HTMLButtonElement).disabled).toBe(true);
      });
    });
  });

  describe.each([
    ['Interact with the scene', () => sdk().renderer.interaction!.setEditingEnabled],
    ['Mute scene audio', () => sdk().renderer.audio!.setMuted],
  ])('when the %s toggle is clicked', (name, setter) => {
    it('should keep its name and flip aria-pressed', () => {
      renderToolbar();
      expect(pressed(name)).toBe('false');
      fireEvent.click(button(name));
      expect(setter()).toHaveBeenCalled();
      expect(pressed(name)).toBe('true');
    });
  });
});
