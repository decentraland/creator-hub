import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { TreeRoot, useTreeItem } from '.';

type RowSpec = { id: string; level: number; expanded?: boolean; selected?: boolean };

function Row({
  spec,
  actions,
  children,
}: {
  spec: RowSpec;
  actions: { select: (mode: 'single' | 'extend') => void; setOpen?: (open: boolean) => void };
  children?: React.ReactNode;
}) {
  const { tabIndex } = useTreeItem(spec.id, actions);
  return (
    <div
      role="treeitem"
      data-tree-id={spec.id}
      aria-label={spec.id}
      aria-level={spec.level}
      aria-expanded={spec.expanded}
      aria-selected={spec.selected ? 'true' : 'false'}
      tabIndex={tabIndex}
    >
      {children}
    </div>
  );
}

const ROWS: RowSpec[] = [
  { id: 'a', level: 1 },
  { id: 'b', level: 1, expanded: false },
  { id: 'c', level: 1, expanded: true },
  { id: 'c1', level: 2 },
];

describe('TreeRoot', () => {
  let actions: Record<
    string,
    { select: ReturnType<typeof vi.fn>; setOpen: ReturnType<typeof vi.fn> }
  >;

  const renderTree = (rows: RowSpec[] = ROWS, withInput = false) =>
    render(
      <TreeRoot label="Test">
        {rows.map(spec => (
          <Row
            key={spec.id}
            spec={spec}
            actions={actions[spec.id]}
          >
            {withInput && spec.id === 'a' ? <input aria-label="Rename" /> : null}
          </Row>
        ))}
      </TreeRoot>,
    );

  const row = (id: string) => screen.getByRole('treeitem', { name: id });
  const tabStops = () => screen.getAllByRole('treeitem').filter(el => el.tabIndex === 0);
  const focusRow = (id: string) => act(() => row(id).focus());

  beforeEach(() => {
    actions = Object.fromEntries(ROWS.map(({ id }) => [id, { select: vi.fn(), setOpen: vi.fn() }]));
  });

  afterEach(cleanup);

  it('should render a multiselectable tree named by its label', () => {
    renderTree();
    const tree = screen.getByRole('tree', { name: 'Test' });
    expect(tree.getAttribute('aria-multiselectable')).toBe('true');
  });

  describe('when nothing is selected', () => {
    it('should make the first row the only tab stop', () => {
      renderTree();
      expect(tabStops()).toEqual([row('a')]);
    });
  });

  describe('when the second row is selected', () => {
    it('should make the selected row the only tab stop', () => {
      renderTree(ROWS.map(spec => (spec.id === 'b' ? { ...spec, selected: true } : spec)));
      expect(tabStops()).toEqual([row('b')]);
    });
  });

  describe('when the selection changes after mount', () => {
    it('should move the tab stop to the newly selected row', async () => {
      const { rerender } = renderTree();
      rerender(
        <TreeRoot label="Test">
          {ROWS.map(spec => (
            <Row
              key={spec.id}
              spec={spec.id === 'c' ? { ...spec, selected: true } : spec}
              actions={actions[spec.id]}
            />
          ))}
        </TreeRoot>,
      );
      await waitFor(() => expect(tabStops()).toEqual([row('c')]));
    });
  });

  describe('when Down is pressed on a focused row', () => {
    beforeEach(() => {
      renderTree();
      focusRow('a');
      fireEvent.keyDown(row('a'), { key: 'ArrowDown' });
    });

    it('should focus the next row', () => {
      expect(document.activeElement).toBe(row('b'));
    });

    it('should move the tab stop with the focus', () => {
      expect(tabStops()).toEqual([row('b')]);
    });
  });

  describe('when Right is pressed on a closed parent', () => {
    it('should open it', () => {
      renderTree();
      focusRow('b');
      fireEvent.keyDown(row('b'), { key: 'ArrowRight' });
      expect(actions.b.setOpen).toHaveBeenCalledWith(true);
    });
  });

  describe('when Left is pressed on an open parent', () => {
    it('should close it', () => {
      renderTree();
      focusRow('c');
      fireEvent.keyDown(row('c'), { key: 'ArrowLeft' });
      expect(actions.c.setOpen).toHaveBeenCalledWith(false);
    });
  });

  describe('when Enter is pressed on a focused row', () => {
    it('should select it once as a plain select', () => {
      renderTree();
      focusRow('b');
      fireEvent.keyDown(row('b'), { key: 'Enter' });
      expect(actions.b.select).toHaveBeenCalledTimes(1);
      expect(actions.b.select).toHaveBeenCalledWith('single');
    });
  });

  describe('when a key comes from an input inside a row', () => {
    it('should neither act nor prevent the key', () => {
      renderTree(ROWS, true);
      const notPrevented = fireEvent.keyDown(screen.getByRole('textbox', { name: 'Rename' }), {
        key: 'ArrowDown',
      });
      expect(notPrevented).toBe(true);
      expect(Object.values(actions).every(a => !a.select.mock.calls.length)).toBe(true);
    });
  });

  describe('when Ctrl is held', () => {
    it('should ignore the key', () => {
      renderTree();
      focusRow('a');
      const notPrevented = fireEvent.keyDown(row('a'), { key: 'ArrowDown', ctrlKey: true });
      expect(notPrevented).toBe(true);
      expect(document.activeElement).toBe(row('a'));
    });
  });

  describe('when a key is handled', () => {
    let documentListener: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      documentListener = vi.fn();
      document.addEventListener('keydown', documentListener);
    });

    afterEach(() => {
      document.removeEventListener('keydown', documentListener);
    });

    it('should prevent it and keep it from reaching document listeners', () => {
      renderTree();
      focusRow('a');
      const notPrevented = fireEvent.keyDown(row('a'), { key: 'ArrowDown' });
      expect(notPrevented).toBe(false);
      expect(documentListener).not.toHaveBeenCalled();
    });

    describe('and the key is Delete', () => {
      it('should not handle it, so document listeners still receive it', () => {
        renderTree();
        focusRow('a');
        const notPrevented = fireEvent.keyDown(row('a'), { key: 'Delete' });
        expect(notPrevented).toBe(true);
        expect(documentListener).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('when Shift + Down is pressed', () => {
    it('should focus the next row and extend the selection to it', () => {
      renderTree();
      focusRow('a');
      fireEvent.keyDown(row('a'), { key: 'ArrowDown', shiftKey: true });
      expect(document.activeElement).toBe(row('b'));
      expect(actions.b.select).toHaveBeenCalledTimes(1);
      expect(actions.b.select).toHaveBeenCalledWith('extend');
      expect(actions.a.select).not.toHaveBeenCalled();
    });

    describe('and the focused row is the last', () => {
      it('should do nothing', () => {
        renderTree();
        focusRow('c1');
        fireEvent.keyDown(row('c1'), { key: 'ArrowDown', shiftKey: true });
        expect(document.activeElement).toBe(row('c1'));
        expect(Object.values(actions).every(a => !a.select.mock.calls.length)).toBe(true);
      });
    });
  });
});
