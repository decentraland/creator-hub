import { contextMenu } from 'react-contexify';
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

import type { Asset } from '../../../../lib/logic/catalog';
import { CatalogAssetContextMenu } from './CatalogAssetContextMenu';
import { CATALOG_ASSET_CONTEXT_MENU_ID } from './ContextMenu';

function renderAndOpen(asset: Partial<Asset>) {
  render(
    <>
      <div
        onContextMenu={event =>
          contextMenu.show({ id: CATALOG_ASSET_CONTEXT_MENU_ID, event, props: { asset } })
        }
      >
        Card
      </div>
      <CatalogAssetContextMenu />
    </>,
  );
  fireEvent.contextMenu(screen.getByText('Card'));
}

const rows = () =>
  Array.from(screen.getByRole('menu').children).map(row => (row.textContent ?? '').trim());

describe('when the catalog asset menu opens', () => {
  afterEach(() => {
    act(() => contextMenu.hideAll());
    cleanup();
  });

  describe('and the asset is a regular asset', () => {
    it('should offer only adding it to the filesystem', () => {
      renderAndOpen({ id: 'cube', name: 'Cube' });

      expect(rows()).toEqual(['Add to Filesystem']);
    });
  });

  describe('and the asset is a built-in emote', () => {
    it('should offer only copying its name', () => {
      renderAndOpen({ id: 'wave', name: 'Wave', builtInEmote: 'wave' });

      expect(rows()).toEqual(['Copy Name']);
    });
  });
});
