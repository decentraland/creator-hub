import React from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

import { TreeRoot } from './TreeRoot';
import { Tree } from '.';

vi.mock('../../redux/hooks', () => ({ useAppSelector: () => [] }));
vi.mock('../../hooks/sdk/useSdk', () => ({ useSdk: () => null }));

type Node = { id: string; name: string; children: Node[] };

const child: Node = { id: 'child', name: 'Child', children: [] };
const sibling: Node = { id: 'sibling', name: 'Sibling', children: [] };
const parent: Node = { id: 'parent', name: 'Parent', children: [child, sibling] };

const NodeTree = Tree<Node>();

describe('Tree', () => {
  let onSelect: ReturnType<typeof vi.fn>;
  let onLastSelectedChange: ReturnType<typeof vi.fn>;

  const row = (name: string) => screen.getByRole('treeitem', { name, hidden: true });

  beforeEach(() => {
    onSelect = vi.fn();
    onLastSelectedChange = vi.fn();
    render(
      <DndProvider backend={HTML5Backend}>
        <TreeRoot label="Test">
          <NodeTree
            value={parent}
            contextMenuLabel="Options"
            getId={n => n.id}
            getChildren={n => n.children}
            getLabel={n => n.name}
            isOpen={() => true}
            isSelected={n => n.id === 'child'}
            isHidden={() => false}
            onSetOpen={vi.fn()}
            onSelect={onSelect}
            onLastSelectedChange={onLastSelectedChange}
            onDrop={vi.fn()}
            onRename={vi.fn()}
            onAddChild={vi.fn()}
            onRemove={vi.fn()}
            onDuplicate={vi.fn()}
            renderActionArea={(n, tabIndex) => (
              <button
                type="button"
                tabIndex={tabIndex}
              >
                Lock {n.name}
              </button>
            )}
          />
        </TreeRoot>
      </DndProvider>,
    );
  });

  afterEach(cleanup);

  it('should render each row as a treeitem at its level', () => {
    expect(row('Parent').getAttribute('aria-level')).toBe('1');
    expect(row('Child').getAttribute('aria-level')).toBe('2');
  });

  it('should mark only the selected row as selected', () => {
    expect(row('Child').getAttribute('aria-selected')).toBe('true');
    expect(row('Parent').getAttribute('aria-selected')).toBe('false');
    expect(row('Sibling').getAttribute('aria-selected')).toBe('false');
  });

  it('should set aria-expanded on the parent only', () => {
    expect(row('Parent').getAttribute('aria-expanded')).toBe('true');
    expect(row('Child').hasAttribute('aria-expanded')).toBe(false);
  });

  it('should name each row by its label alone', () => {
    expect(row('Child').getAttribute('data-tree-id')).toBe('child');
  });

  it('should hide the caret from assistive technology', () => {
    expect(row('Parent').querySelector('.caret')?.getAttribute('aria-hidden')).toBe('true');
  });

  describe('when a row is focused', () => {
    const lock = (name: string) =>
      screen.getByRole('button', { name: `Lock ${name}`, hidden: true });

    beforeEach(() => {
      act(() => row('Sibling').focus());
    });

    it("should make only that row's actions tabbable", () => {
      expect(lock('Sibling').tabIndex).toBe(0);
      expect(lock('Child').tabIndex).toBe(-1);
      expect(lock('Parent').tabIndex).toBe(-1);
    });
  });

  describe('when Enter is pressed on a focused row', () => {
    beforeEach(() => {
      act(() => row('Sibling').focus());
      fireEvent.keyDown(row('Sibling'), { key: 'Enter' });
    });

    it('should select it as a plain click does', () => {
      expect(onLastSelectedChange).toHaveBeenCalledWith(sibling);
      expect(onSelect).toHaveBeenCalledWith(sibling, 'single');
    });
  });

  describe('when Shift + Down is pressed on the first row', () => {
    beforeEach(() => {
      act(() => row('Parent').focus());
      fireEvent.keyDown(row('Parent'), { key: 'ArrowDown', shiftKey: true });
    });

    it('should extend the selection to the next row', () => {
      expect(onSelect).toHaveBeenCalledWith(child, 'shift');
    });

    it('should keep the range anchor where it was', () => {
      expect(onLastSelectedChange).not.toHaveBeenCalled();
    });
  });
});
