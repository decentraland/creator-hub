import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { flatten } from 'flat';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { dark, ThemeProvider } from 'decentraland-ui2/dist/theme';
import { dclColors } from 'decentraland-ui2';

import { en } from '/@/modules/store/translation/locales';
import { setCurrentLocale } from '/@/modules/store/translation/utils';

import { ParcelPickerModal } from '.';

type Layer = (x: number, y: number) => { color: string; scale?: number } | null;
type Coord = { x: number; y: number };
type AtlasProps = {
  layers: Layer[];
  onClick: (x: number, y: number) => void;
  onChange: (viewport: { nw: Coord; se: Coord }) => void;
  x?: number;
  y?: number;
};

let atlas: AtlasProps;

vi.mock('/@/components/WorldAtlas', async importOriginal => ({
  ...(await importOriginal<object>()),
  WorldAtlas: (props: AtlasProps) => {
    atlas = props;
    return null;
  },
}));
vi.mock('../AvatarWithInfo', () => ({
  AvatarWithInfo: ({ value }: { value: string }) => <span>{value}</span>,
}));

const ALLOWED = ['0,0', '1,0', '3,0', '1,1'];

function renderModal(initialParcels: string[] = []) {
  const onCancel = vi.fn();
  const onConfirm = vi.fn();
  render(
    <ThemeProvider theme={dark}>
      <ParcelPickerModal
        open
        name="Fixture Ben"
        walletAddress="0x00000000000000000000000000000000000000b2"
        scenes={[{ parcels: ALLOWED }]}
        initialParcels={new Set(initialParcels)}
        allowed={new Set(ALLOWED)}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    </ThemeProvider>,
  );
  return { onCancel, onConfirm };
}

const map = () => screen.getByRole('application', { name: 'Parcels for Fixture Ben' });
const press = (key: string) => fireEvent.keyDown(map(), { key });
const cursorAt = (x: number, y: number) =>
  atlas.layers.some(layer => layer(x, y)?.color === dclColors.neutral.softWhite);
const announced = () =>
  screen
    .getAllByRole('status')
    .map(region => region.textContent)
    .join(' | ');

describe('ParcelPickerModal', () => {
  beforeAll(() => {
    setCurrentLocale('en', flatten(en));
  });

  afterEach(cleanup);

  describe('when it opens', () => {
    beforeEach(() => {
      renderModal();
    });

    it('should be a dialog named Update parcels, describing the map and its keys', () => {
      expect(screen.getByRole('dialog', { name: 'Update parcels' })).toBeTruthy();
      expect(map().getAttribute('aria-roledescription')).toBe('parcel map');
      expect(map().tabIndex).toBe(0);
      expect(document.getElementById(map().getAttribute('aria-describedby')!)?.textContent).toBe(
        'Use the arrow keys to move between parcels and Space or Enter to select or deselect one.',
      );
    });

    it('should block CONFIRM while nothing is selected', () => {
      expect(screen.getByRole('button', { name: 'Confirm' })).toHaveProperty('disabled', true);
    });

    it('should draw no cursor before the map has keyboard focus', () => {
      expect(ALLOWED.some(id => cursorAt(...(id.split(',').map(Number) as [number, number])))).toBe(
        false,
      );
    });
  });

  describe('when the map gets keyboard focus', () => {
    beforeEach(() => {
      renderModal();
      act(() => map().focus());
    });

    it('should put the cursor on the allowed parcel nearest the centre and read it', () => {
      expect(cursorAt(1, 0)).toBe(true);
      expect(announced()).toContain('Parcel 1,0, not selected');
    });

    it('should move the cursor only across allowed parcels, and not past the last one', () => {
      expect(press('ArrowRight')).toBe(false);
      expect(cursorAt(3, 0)).toBe(true);

      press('ArrowRight');
      expect(cursorAt(3, 0)).toBe(true);

      press('ArrowLeft');
      press('ArrowLeft');
      expect(cursorAt(0, 0)).toBe(true);

      press('ArrowDown');
      expect(cursorAt(0, 0)).toBe(true);
      expect(announced()).toContain('Parcel 0,0, not selected');
    });

    it('should move up to the parcel north of it', () => {
      press('ArrowUp');

      expect(cursorAt(1, 1)).toBe(true);
    });

    it('should select with Space and deselect with Enter, announcing the parcel and the count', () => {
      press(' ');

      expect(announced()).toContain('Parcel 1,0, selected');
      expect(announced()).toContain('Selecting 1 parcel');
      expect(screen.getByRole('button', { name: 'Confirm' })).toHaveProperty('disabled', false);

      press('Enter');

      expect(announced()).toContain('Parcel 1,0, not selected');
      expect(announced()).toContain('Selecting 0 parcels');
    });
  });

  describe('when the cursor moves before the atlas has reported its viewport', () => {
    it('should leave the atlas where it opened', () => {
      renderModal();
      act(() => map().focus());
      press('ArrowRight');

      expect([atlas.x, atlas.y]).toEqual([undefined, undefined]);
    });
  });

  describe('when the cursor leaves the reported viewport', () => {
    it('should centre the atlas on the cursor, and not while it stays inside', () => {
      renderModal();
      act(() => atlas.onChange({ nw: { x: -5, y: 6 }, se: { x: 4, y: -5 } }));
      act(() => map().focus());

      expect([atlas.x, atlas.y]).toEqual([undefined, undefined]);

      press('ArrowRight');

      expect([atlas.x, atlas.y]).toEqual([3, 0]);
    });
  });

  describe('when the map is focused by the mouse', () => {
    it('should draw no cursor', () => {
      renderModal();
      fireEvent.mouseDown(map());
      act(() => map().focus());

      expect(cursorAt(1, 0)).toBe(false);
    });
  });

  describe('when a parcel is clicked', () => {
    it('should select it and move the cursor there', () => {
      renderModal();
      act(() => atlas.onClick(3, 0));
      act(() => map().focus());

      expect(announced()).toContain('Selecting 1 parcel');
      expect(cursorAt(3, 0)).toBe(true);
    });
  });

  describe('when it opens with parcels already chosen', () => {
    it('should start the cursor on the first of them', () => {
      renderModal(['0,0']);
      act(() => map().focus());

      expect(cursorAt(0, 0)).toBe(true);
    });
  });

  describe('when the choice is confirmed or cancelled', () => {
    it('should hand the selection to CONFIRM', () => {
      const { onConfirm } = renderModal();
      act(() => map().focus());
      press(' ');

      fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

      expect(onConfirm).toHaveBeenCalledWith(['1,0']);
    });

    it('should cancel from CANCEL, and from Escape on the map', () => {
      const { onCancel } = renderModal();

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      press('Escape');

      expect(onCancel).toHaveBeenCalledTimes(2);
    });
  });
});
