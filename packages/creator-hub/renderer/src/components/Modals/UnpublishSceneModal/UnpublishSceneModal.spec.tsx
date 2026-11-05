import { Provider } from 'react-redux';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { flatten } from 'flat';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { dark, ThemeProvider } from 'decentraland-ui2/dist/theme';

import { unpublishLandScene } from '/@/modules/store/management/slice';
import { en } from '/@/modules/store/translation/locales';
import { setCurrentLocale } from '/@/modules/store/translation/utils';

import { createTestStore } from '../../../../tests/utils/testStore';
import { UnpublishSceneModal, type LandScene, type UnpublishTarget } from '.';

vi.mock('/@/modules/store/management/slice', async importOriginal => ({
  ...(await importOriginal<object>()),
  unpublishLandScene: vi.fn(),
}));

const scene = (id: string, title: string): LandScene => ({
  id,
  title,
  base: '96,15',
  parcels: ['96,15'],
  timestamp: 0,
  thumbnail: '',
});

const outcomes = (...results: boolean[]) =>
  results.forEach(ok =>
    vi.mocked(unpublishLandScene).mockImplementationOnce(
      () =>
        (() => ({
          unwrap: () => (ok ? Promise.resolve() : Promise.reject(new Error('500'))),
        })) as never,
    ),
  );

function renderModal(target: UnpublishTarget) {
  const handlers = { onClose: vi.fn(), onUnpublished: vi.fn() };
  render(
    <Provider store={createTestStore() as never}>
      <ThemeProvider theme={dark}>
        <UnpublishSceneModal
          open
          target={target}
          landName="Land Name"
          {...handlers}
        />
      </ThemeProvider>
    </Provider>,
  );
  return handlers;
}

describe('UnpublishSceneModal', () => {
  beforeAll(() => {
    setCurrentLocale('en', flatten(en));
  });

  afterEach(cleanup);

  describe('when one scene unpublishes', () => {
    it('should ask in Figma words, then close and report it', async () => {
      outcomes(true);
      const { onClose, onUnpublished } = renderModal({ kind: 'one', scene: scene('a', 'Scene A') });

      expect(screen.getByText(/unpublish/i, { selector: 'div' }).textContent).toBe(
        'Are you sure you want to unpublish Scene A from Land Name?',
      );
      await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Unpublish' })));

      expect(onUnpublished).toHaveBeenCalledWith(['a']);
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('when one scene fails to unpublish', () => {
    it('should stay open with the error', async () => {
      outcomes(false);
      const { onClose } = renderModal({ kind: 'one', scene: scene('a', 'Scene A') });

      await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Unpublish' })));

      expect(screen.getByRole('alert').textContent).toBe("Couldn't unpublish Scene A. Try again.");
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('when the second of two scenes fails', () => {
    it('should report the first, keep the second and offer to try again', async () => {
      outcomes(true, false);
      const { onUnpublished } = renderModal({
        kind: 'many',
        scenes: [scene('a', 'Scene A'), scene('b', 'Scene B')],
      });

      await act(async () =>
        fireEvent.click(screen.getByRole('button', { name: 'Unpublish 2 scenes' })),
      );

      expect(onUnpublished).toHaveBeenCalledWith(['a']);
      expect(screen.getByRole('alert').textContent).toBe("Couldn't unpublish Scene B. Try again.");
      expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
    });
  });
});
