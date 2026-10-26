import { contextMenu } from 'react-contexify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { Entity } from '@dcl/ecs';

import { ContextMenu as Menu } from '../../ContexMenu';
import ContextMenu from './ContextMenu';

vi.mock('../../../hooks/sdk/useSdk', () => ({ useSdk: () => null }));
vi.mock('../../../hooks/sdk/useEntityComponent', () => ({
  useEntityComponent: () => ({
    getComponents: () => new Map(),
    addComponent: vi.fn(),
    getAvailableComponents: () => [
      { id: 1, name: 'Actions', isOnEntity: false },
      { id: 2, name: 'Animator', isOnEntity: false },
    ],
  }),
}));
vi.mock('../../../hooks/sdk/useEntitiesWith', () => ({ useEntitiesWith: () => [] }));
vi.mock('../../../hooks/sdk/useTree', () => ({ useTree: () => ({ select: vi.fn() }) }));
vi.mock('../../../redux/hooks', () => ({
  useAppDispatch: () => vi.fn(),
  useAppSelector: () => undefined,
}));

const MENU_ID = 'entity-menu';

function EntityMenuItems() {
  return ContextMenu(512 as Entity);
}

describe('when the entity menu offers components to add', () => {
  beforeEach(() => {
    render(
      <>
        <div onContextMenu={event => contextMenu.show({ id: MENU_ID, event })}>Magic Cube</div>
        <Menu
          id={MENU_ID}
          label="Entity Options"
        >
          <EntityMenuItems />
        </Menu>
      </>,
    );
    fireEvent.contextMenu(screen.getByText('Magic Cube'));
  });

  afterEach(() => {
    act(() => contextMenu.hideAll());
    cleanup();
  });

  it('should name the submenu item by its label alone and keep its popup', () => {
    const submenu = screen.getByRole('menuitem', { name: 'Add Component' });

    expect(submenu.getAttribute('aria-haspopup')).toBe('true');
  });

  it('should group the components to add in a nested menu named after the submenu item', () => {
    const nested = screen.getByRole('menu', { name: 'Add Component' });

    expect(within(nested).getByRole('menuitem', { name: 'Actions' })).toBeTruthy();
  });
});
