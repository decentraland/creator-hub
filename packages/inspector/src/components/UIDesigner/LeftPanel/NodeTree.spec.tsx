import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { setNodeHidden, setNodeLocked } from '../../../redux/ui-designer';
import type { UINode } from '../shared/tree-model';
import { NodeTree } from './NodeTree';

const mocks = vi.hoisted(() => ({
  dispatch: vi.fn(),
  tree: null as UINode | null,
  locked: {} as Record<number, boolean>,
  hidden: {} as Record<number, boolean>,
}));

vi.mock('../../Tree', () => {
  type RowProps = { value: UINode; renderActionArea: (n: UINode) => React.ReactNode };
  const Row = ({ value, renderActionArea }: RowProps): JSX.Element => (
    <div>
      {renderActionArea(value)}
      {value.children.map(child => (
        <Row
          key={child.entity}
          value={child}
          renderActionArea={renderActionArea}
        />
      ))}
    </div>
  );
  return { Tree: () => Row };
});

vi.mock('../shared/useUINodeTree', () => ({ useUINodeTree: () => mocks.tree }));
vi.mock('../shared/useUINodeActions', () => ({
  useUINodeActions: () => ({ remove: vi.fn(), duplicate: vi.fn() }),
}));
vi.mock('../code/store', () => ({
  addPlatformBranch: vi.fn(),
  spliceAddWidget: vi.fn(),
  spliceMove: vi.fn(),
  spliceRenameNode: vi.fn(),
}));

vi.mock('../../../redux/hooks', () => ({
  useAppSelector: (selector: (state: unknown) => unknown) =>
    selector({
      uiDesigner: {
        selectedNodes: [],
        expanded: {},
        hidden: mocks.hidden,
        locked: mocks.locked,
        platform: 'desktop',
      },
    }),
  useAppDispatch: () => mocks.dispatch,
}));

const node = (over: Partial<UINode> = {}): UINode =>
  ({
    entity: 7,
    type: 'UiEntity',
    name: 'Panel',
    uiName: 'Panel',
    children: [],
    ...over,
  }) as unknown as UINode;

describe('NodeTree row actions', () => {
  beforeEach(() => {
    mocks.dispatch.mockClear();
    mocks.tree = node();
    mocks.locked = {};
    mocks.hidden = {};
  });

  describe('when the node is unlocked and visible', () => {
    it('should render the lock and eye as unpressed toggle buttons', () => {
      render(<NodeTree />);
      const lock = screen.getByRole('button', { name: 'Lock Panel' });
      const eye = screen.getByRole('button', { name: 'Hide Panel' });
      expect(lock.tagName).toBe('BUTTON');
      expect(eye.tagName).toBe('BUTTON');
      expect(lock.getAttribute('aria-pressed')).toBe('false');
      expect(eye.getAttribute('aria-pressed')).toBe('false');
    });

    it('should render no delete button in the row', () => {
      render(<NodeTree />);
      expect(screen.queryByRole('button', { name: /^Delete / })).toBeNull();
    });

    it('should lock the node when the lock is clicked', () => {
      render(<NodeTree />);
      fireEvent.click(screen.getByRole('button', { name: 'Lock Panel' }));
      expect(mocks.dispatch).toHaveBeenCalledWith(
        setNodeLocked({ entity: 7 as never, locked: true }),
      );
    });

    it('should hide the node when the eye is clicked', () => {
      render(<NodeTree />);
      fireEvent.click(screen.getByRole('button', { name: 'Hide Panel' }));
      expect(mocks.dispatch).toHaveBeenCalledWith(
        setNodeHidden({ entity: 7 as never, hidden: true }),
      );
    });
  });

  describe('when the node is locked and hidden', () => {
    beforeEach(() => {
      mocks.locked = { 7: true };
      mocks.hidden = { 7: true };
    });

    it('should render the lock and eye pressed', () => {
      render(<NodeTree />);
      expect(screen.getByRole('button', { name: 'Lock Panel' }).getAttribute('aria-pressed')).toBe(
        'true',
      );
      expect(screen.getByRole('button', { name: 'Hide Panel' }).getAttribute('aria-pressed')).toBe(
        'true',
      );
    });
  });

  describe('when a hidden parent has a visible child', () => {
    const childArea = () =>
      screen.getByRole('button', { name: 'Lock Title' }).closest('.action-area') as HTMLElement;

    beforeEach(() => {
      mocks.tree = node({
        children: [node({ entity: 8, uiName: 'Title' } as unknown as Partial<UINode>)],
      });
      mocks.hidden = { 7: true };
    });

    it('should mark the child as inheriting the hidden state', () => {
      render(<NodeTree />);
      expect(childArea().classList.contains('is-hidden-inherited')).toBe(true);
    });

    it('should render two inert dots in place of the toggles', () => {
      render(<NodeTree />);
      const dots = childArea().querySelectorAll('.inherited-dot');
      expect(dots).toHaveLength(2);
      dots.forEach(dot => expect(dot.getAttribute('aria-hidden')).toBe('true'));
    });

    it("should keep the child's own unpressed lock and eye", () => {
      render(<NodeTree />);
      expect(screen.getByRole('button', { name: 'Lock Title' }).getAttribute('aria-pressed')).toBe(
        'false',
      );
      expect(screen.getByRole('button', { name: 'Hide Title' }).getAttribute('aria-pressed')).toBe(
        'false',
      );
    });

    describe('and the child is locked', () => {
      beforeEach(() => {
        mocks.locked = { 8: true };
      });

      it('should render only the eye dot and a pressed lock', () => {
        render(<NodeTree />);
        expect(childArea().querySelectorAll('.inherited-dot')).toHaveLength(1);
        expect(
          screen.getByRole('button', { name: 'Lock Title' }).getAttribute('aria-pressed'),
        ).toBe('true');
      });
    });
  });

  describe('when the node is a platform switch missing a branch', () => {
    beforeEach(() => {
      mocks.tree = node({ platformVariant: true } as Partial<UINode>);
    });

    it('should render each add-variant action as a button', () => {
      render(<NodeTree />);
      expect(screen.getByRole('button', { name: 'Add Desktop variant' }).tagName).toBe('BUTTON');
    });
  });
});
