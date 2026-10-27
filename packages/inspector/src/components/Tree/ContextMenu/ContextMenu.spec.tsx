import { contextMenu, Item } from 'react-contexify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

import ContextMenu from './ContextMenu';
import type { Props } from './ContextMenu';

const MENU_ID = 'tree-menu';

function renderAndOpen(overrides: Partial<Props> = {}) {
  render(
    <>
      <div onContextMenu={event => contextMenu.show({ id: MENU_ID, event })}>Row</div>
      <ContextMenu
        id={MENU_ID}
        label="Entity Options"
        onAddChild={vi.fn()}
        onEdit={vi.fn()}
        onRemove={vi.fn()}
        onDuplicate={vi.fn()}
        extra={<Item>Copy Path</Item>}
        {...overrides}
      />
    </>,
  );
  fireEvent.contextMenu(screen.getByText('Row'));
}

const rowsAndDividers = () =>
  Array.from(screen.getByRole('menu').children).map(row =>
    row.getAttribute('role') === 'separator' ? '─' : (row.textContent ?? '').trim(),
  );

describe('when a tree row menu opens', () => {
  afterEach(() => {
    act(() => contextMenu.hideAll());
    cleanup();
  });

  describe('and it has both edit actions and extra items', () => {
    it('should divide the edit actions from the extra items', () => {
      renderAndOpen();

      expect(rowsAndDividers()).toEqual([
        'Rename',
        'Add Child',
        'Duplicate',
        'Delete',
        '─',
        'Copy Path',
      ]);
    });
  });

  describe('and no edit action is enabled', () => {
    it('should show the extra items without a leading divider', () => {
      renderAndOpen({
        enableAdd: false,
        enableEdit: false,
        enableRemove: false,
        enableDuplicate: false,
      });

      expect(rowsAndDividers()).toEqual(['Copy Path']);
    });
  });

  describe('and there are no extra items', () => {
    it('should not end with a divider', () => {
      renderAndOpen({ extra: null });

      expect(rowsAndDividers()).toEqual(['Rename', 'Add Child', 'Duplicate', 'Delete']);
    });
  });
});
