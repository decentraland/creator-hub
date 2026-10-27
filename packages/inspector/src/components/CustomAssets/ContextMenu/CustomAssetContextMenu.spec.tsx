import { contextMenu } from 'react-contexify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

import { CustomAssetContextMenu } from './CustomAssetContextMenu';
import { CUSTOM_ASSETS_CONTEXT_MENU_ID } from './ContextMenu';

describe('when the custom item menu opens', () => {
  beforeEach(() => {
    render(
      <>
        <div
          onContextMenu={event => contextMenu.show({ id: CUSTOM_ASSETS_CONTEXT_MENU_ID, event })}
        >
          Magic Cube
        </div>
        <CustomAssetContextMenu />
      </>,
    );
    fireEvent.contextMenu(screen.getByText('Magic Cube'));
  });

  afterEach(() => {
    act(() => contextMenu.hideAll());
    cleanup();
  });

  it('should divide adding to the filesystem from the edit actions', () => {
    const rows = Array.from(screen.getByRole('menu').children).map(row =>
      row.getAttribute('role') === 'separator' ? '─' : (row.textContent ?? '').trim(),
    );

    expect(rows).toEqual(['Add to Filesystem', '─', 'Rename', 'Delete']);
  });
});
