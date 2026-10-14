import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flatten } from 'flat';
import { dark, ThemeProvider } from 'decentraland-ui2/dist/theme';

import type { File } from '/@/lib/deploy';
import en from '/@/modules/store/translation/locales/en.json';
import { setCurrentLocale } from '/@/modules/store/translation/utils';

import { Idle } from './component';

/** The real store module boots the app on import. */
vi.mock('#store', async () => {
  const { useDispatch, useSelector } = await import('react-redux');
  return { useDispatch, useSelector };
});

const MiB = 1024 * 1024;

const SCENE_SIZE_EXCEEDED =
  'Your scene exceeds the maximum allowed size. Reduce the number or size of assets and try again.';

describe('Idle', () => {
  let files: File[];
  let sceneSizeLimit: number | null;
  let onClick: () => void;

  const getSize = () => screen.getByText(/^Total Size/);
  const getPublishButton = () => screen.getByRole('button', { name: /publish/i });

  afterEach(cleanup);

  beforeEach(() => {
    setCurrentLocale('en', flatten(en));
    files = [
      { name: 'models/house.glb', size: 20 * MiB },
      { name: 'textures/wall.png', size: 10 * MiB },
    ];
    onClick = vi.fn();
  });

  const renderIdle = () =>
    render(
      <ThemeProvider theme={dark}>
        <Idle
          files={files}
          sceneSizeLimit={sceneSizeLimit}
          onClick={onClick}
        />
      </ThemeProvider>,
    );

  describe('when the scene size limit is unknown', () => {
    beforeEach(() => {
      sceneSizeLimit = null;
      renderIdle();
    });

    it('should show only the total size of the scene', () => {
      expect(getSize().textContent).toBe('Total Size 30.00 MB');
    });

    it('should let the scene be published', () => {
      expect((getPublishButton() as HTMLButtonElement).disabled).toBe(false);
    });
  });

  describe('when the scene fits within the scene size limit', () => {
    beforeEach(() => {
      sceneSizeLimit = 45 * MiB;
      renderIdle();
    });

    it('should show the total size against the scene size limit', () => {
      expect(getSize().textContent).toBe('Total Size 30.00 MB / 45.00 MB');
    });

    it('should not mark the total size as invalid', () => {
      expect(getSize().classList.contains('invalid')).toBe(false);
    });

    it('should let the scene be published', () => {
      expect((getPublishButton() as HTMLButtonElement).disabled).toBe(false);
    });
  });

  describe('when the scene exceeds the scene size limit', () => {
    beforeEach(() => {
      sceneSizeLimit = 15 * MiB;
      renderIdle();
    });

    it('should mark the total size as invalid', () => {
      expect(getSize().classList.contains('invalid')).toBe(true);
    });

    it('should explain that the scene is too big', () => {
      expect(screen.getByText(SCENE_SIZE_EXCEEDED)).toBeTruthy();
    });

    it('should block publishing', () => {
      expect((getPublishButton() as HTMLButtonElement).disabled).toBe(true);
    });
  });

  describe('when a file exceeds the per-file limit', () => {
    beforeEach(() => {
      files = [{ name: 'models/huge.glb', size: 60 * 1e6 }];
      sceneSizeLimit = 75 * MiB;
      renderIdle();
    });

    it('should mark that file as invalid', () => {
      expect(
        screen.getByTitle('models/huge.glb').parentElement?.classList.contains('invalid'),
      ).toBe(true);
    });

    it('should not mark the total size as invalid', () => {
      expect(getSize().classList.contains('invalid')).toBe(false);
    });
  });
});
