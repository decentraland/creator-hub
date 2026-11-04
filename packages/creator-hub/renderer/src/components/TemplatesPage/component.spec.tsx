import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { cleanup, render, screen } from '@testing-library/react';
import { flatten } from 'flat';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { dark, ThemeProvider } from 'decentraland-ui2/dist/theme';

import { en } from '/@/modules/store/translation/locales';
import { setCurrentLocale } from '/@/modules/store/translation/utils';

import { createTestStore } from '../../../tests/utils/testStore';
import { TemplatesPage } from '.';

vi.mock('../Navbar', async importOriginal => ({
  ...(await importOriginal<object>()),
  Navbar: ({ active }: { active: string }) => <div data-testid="navbar">{active}</div>,
}));
vi.mock('../Tutorials', () => ({
  TutorialsWrapper: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('TemplatesPage', () => {
  beforeAll(() => {
    setCurrentLocale('en', flatten(en));
  });

  afterEach(() => {
    cleanup();
  });

  describe('when it renders', () => {
    it('should mark Templates as the active navbar section', () => {
      render(
        <Provider store={createTestStore()}>
          <ThemeProvider theme={dark}>
            <MemoryRouter>
              <TemplatesPage />
            </MemoryRouter>
          </ThemeProvider>
        </Provider>,
      );
      expect(screen.getByTestId('navbar').textContent).toBe('templates');
    });
  });
});
