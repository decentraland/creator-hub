import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Entity } from '@dcl/ecs';

import ActionArea from './ActionArea';

const sdk = vi.hoisted(() => ({
  components: {
    Lock: { componentId: 1, has: () => false },
    Hide: { componentId: 2, has: () => false },
  },
  operations: { lock: vi.fn(), hide: vi.fn(), dispatch: vi.fn() },
}));

vi.mock('../../../hooks/sdk/useSdk', () => ({ useSdk: () => sdk }));
vi.mock('../../../hooks/sdk/useChange', () => ({ useChange: () => undefined }));
vi.mock('../../../lib/logic/analytics', () => ({
  analytics: { track: vi.fn() },
  Event: { HIDE: 'hide', LOCK: 'lock' },
}));

const entity = 512 as Entity;

describe('ActionArea', () => {
  let onRowClick: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onRowClick = vi.fn();
    render(
      <div onClick={onRowClick}>
        <ActionArea
          entity={entity}
          label="Magic Cube"
          tabIndex={-1}
        />
      </div>,
    );
  });

  afterEach(cleanup);

  it('should render the lock and eye as unpressed toggle buttons named by the label', () => {
    const lock = screen.getByRole('button', { name: 'Lock Magic Cube' });
    const eye = screen.getByRole('button', { name: 'Hide Magic Cube' });
    expect(lock.tagName).toBe('BUTTON');
    expect(eye.tagName).toBe('BUTTON');
    expect(lock.getAttribute('aria-pressed')).toBe('false');
    expect(eye.getAttribute('aria-pressed')).toBe('false');
  });

  it("should give both toggles the row's tabIndex", () => {
    expect(screen.getByRole('button', { name: 'Lock Magic Cube' }).getAttribute('tabindex')).toBe(
      '-1',
    );
    expect(screen.getByRole('button', { name: 'Hide Magic Cube' }).getAttribute('tabindex')).toBe(
      '-1',
    );
  });

  describe('when the visibility toggle is clicked', () => {
    beforeEach(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Hide Magic Cube' }));
    });

    it('should toggle the Hide component', () => {
      expect(sdk.operations.hide).toHaveBeenCalledWith(entity, true);
    });

    it('should dispatch, since the row no longer does it for the bubbled click', () => {
      expect(sdk.operations.dispatch).toHaveBeenCalled();
    });

    it('should not let the click reach the row, so it never counts toward a double-click', () => {
      expect(onRowClick).not.toHaveBeenCalled();
    });
  });

  describe('when the lock toggle is clicked', () => {
    beforeEach(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Lock Magic Cube' }));
    });

    it('should toggle the Lock component', () => {
      expect(sdk.operations.lock).toHaveBeenCalledWith(entity, true);
    });

    it('should dispatch, since the row no longer does it for the bubbled click', () => {
      expect(sdk.operations.dispatch).toHaveBeenCalled();
    });

    it('should not let the click reach the row', () => {
      expect(onRowClick).not.toHaveBeenCalled();
    });
  });
});
