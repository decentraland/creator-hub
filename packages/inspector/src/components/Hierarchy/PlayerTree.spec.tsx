import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

import { PLAYER } from '../../lib/sdk/tree';
import { TreeRoot } from '../Tree/TreeRoot';
import PlayerTree from './PlayerTree';

const mocks = vi.hoisted(() => {
  const visibilityListeners: ((change: { name: string; visible: boolean }) => void)[] = [];
  const spawnPoints = {
    getSelectedIndex: () => null,
    getSelectedTarget: () => null,
    onSelectionChange: () => () => undefined,
    onVisibilityChange: (listener: (change: { name: string; visible: boolean }) => void) => {
      visibilityListeners.push(listener);
      return () => undefined;
    },
    isHidden: () => false,
    select: vi.fn(),
    selectCameraTarget: vi.fn(),
    setVisible: vi.fn(),
  };
  return {
    visibilityListeners,
    spawnPoints,
    sdk: {
      components: { Scene: {} },
      engine: { RootEntity: 0 },
      renderer: { spawnPoints },
    },
  };
});

vi.mock('../../hooks/sdk/useSdk', () => ({ useSdk: () => mocks.sdk }));
vi.mock('../../hooks/sdk/useEntitiesWith', () => ({ useEntitiesWith: () => [] }));
vi.mock('../../hooks/sdk/useComponentValue', () => ({
  useComponentValue: () => [{ spawnPoints: [{ name: 'Spawn A', default: true }] }, vi.fn()],
}));
vi.mock('../../hooks/sdk/useContextMenu', () => ({
  useContextMenu: () => ({ handleAction: (fn: () => void) => fn }),
}));
vi.mock('../../redux/hooks', () => ({ useAppSelector: () => false }));

describe('PlayerTree', () => {
  let onSelect: ReturnType<typeof vi.fn>;

  const row = (name: string) => screen.getByRole('treeitem', { name, hidden: true });

  beforeEach(() => {
    onSelect = vi.fn();
    mocks.visibilityListeners.length = 0;
    mocks.spawnPoints.select.mockClear();
    render(
      <TreeRoot label="Hierarchy">
        <PlayerTree onSelect={onSelect} />
      </TreeRoot>,
    );
  });

  afterEach(cleanup);

  it('should render the Player and spawn rows as expandable treeitems at levels 1 and 2', () => {
    expect(row('Player').getAttribute('aria-level')).toBe('1');
    expect(row('Player').getAttribute('aria-expanded')).toBe('true');
    expect(row('Spawn A (Main)').getAttribute('aria-level')).toBe('2');
    expect(row('Spawn A (Main)').getAttribute('aria-expanded')).toBe('false');
  });

  it('should label the spawn row with the text it shows, "(Main)" badge spaced', () => {
    const labelId = row('Spawn A (Main)').getAttribute('aria-labelledby') ?? '';
    expect(document.getElementById(labelId)?.textContent).toBe('Spawn A (Main)');
  });

  describe('when the spawn point is hidden', () => {
    beforeEach(() => {
      act(() => mocks.visibilityListeners.forEach(fn => fn({ name: 'Spawn A', visible: false })));
    });

    it('should render the eye as a pressed button named by the spawn point', () => {
      const eye = screen.getByRole('button', { name: 'Hide Spawn A', hidden: true });
      expect(eye.tagName).toBe('BUTTON');
      expect(eye.getAttribute('aria-pressed')).toBe('true');
    });
  });

  describe('when Shift + Down moves from the Player row onto a spawn row', () => {
    beforeEach(() => {
      act(() => row('Player').focus());
      fireEvent.keyDown(row('Player'), { key: 'ArrowDown', shiftKey: true });
    });

    it('should focus the spawn row', () => {
      expect(document.activeElement).toBe(row('Spawn A (Main)'));
    });

    it('should leave the selection unchanged', () => {
      expect(onSelect).not.toHaveBeenCalled();
      expect(mocks.spawnPoints.select).not.toHaveBeenCalled();
    });
  });

  describe('when Shift + Up moves from a spawn row onto the Player row', () => {
    beforeEach(() => {
      act(() => row('Spawn A (Main)').focus());
      fireEvent.keyDown(row('Spawn A (Main)'), { key: 'ArrowUp', shiftKey: true });
    });

    it('should clear the spawn selection and add the Player to the selection', () => {
      expect(mocks.spawnPoints.select).toHaveBeenCalledWith(null);
      expect(onSelect).toHaveBeenCalledWith(PLAYER, true);
    });
  });

  describe('when a row is focused', () => {
    const eye = () => screen.getByRole('button', { name: 'Hide Spawn A', hidden: true });

    it("should make only the focused row's actions tabbable", () => {
      act(() => row('Spawn A (Main)').focus());
      expect(eye().tabIndex).toBe(0);
      act(() => row('Player').focus());
      expect(eye().tabIndex).toBe(-1);
    });
  });
});
