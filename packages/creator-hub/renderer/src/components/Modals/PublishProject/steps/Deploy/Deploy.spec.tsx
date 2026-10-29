import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { flatten } from 'flat';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { dark, ThemeProvider } from 'decentraland-ui2/dist/theme';

import type { Info } from '/@/lib/deploy';
import { en } from '/@/modules/store/translation/locales';
import { setCurrentLocale } from '/@/modules/store/translation/utils';

import { Success } from './component';

const info = { isWorld: true } as Info;

function renderSuccess(worldName: string | undefined, onClose = vi.fn()) {
  render(
    <MemoryRouter initialEntries={['/scenes']}>
      <ThemeProvider theme={dark}>
        <Routes>
          <Route
            path="/scenes"
            element={
              <Success
                info={info}
                url="https://decentraland.org/jump/?realm=plaza.dcl.eth"
                worldName={worldName}
                onClick={vi.fn()}
                onClose={onClose}
              />
            }
          />
          <Route
            path="/manage/world/:name/:tab"
            element={<p>World page</p>}
          />
        </Routes>
      </ThemeProvider>
    </MemoryRouter>,
  );
  return onClose;
}

describe('Deploy Success', () => {
  beforeAll(() => {
    setCurrentLocale('en', flatten(en));
  });

  afterEach(() => {
    cleanup();
  });

  describe('when a World was published', () => {
    it('should link to its Settings tab, closing the publish modal', () => {
      const onClose = renderSuccess('plaza.dcl.eth');

      const link = screen.getByRole('link', { name: 'World Settings' });
      expect(link.getAttribute('href')).toBe('/manage/world/plaza.dcl.eth/settings');

      fireEvent.click(link);

      expect(onClose).toHaveBeenCalled();
      expect(screen.getByText('World page')).toBeTruthy();
    });
  });

  describe('when LAND was published', () => {
    it('should offer no World Settings link', () => {
      renderSuccess(undefined);

      expect(screen.queryByRole('link', { name: 'World Settings' })).toBeNull();
    });
  });
});
