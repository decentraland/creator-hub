import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { cleanup, render, screen } from '@testing-library/react';
import { flatten } from 'flat';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { en } from '/@/modules/store/translation/locales';
import { setCurrentLocale } from '/@/modules/store/translation/utils';

import { createTestStore } from '../../../tests/utils/testStore';
import { Navbar, NavbarItem } from '.';

vi.mock('/@/hooks/useFeatureFlags', () => ({ useFeatureFlags: () => ({ isEnabled: () => true }) }));
vi.mock('/@/hooks/useEditor', () => ({ useEditor: () => ({ version: '0.0.0' }) }));
vi.mock('../Header', () => ({
  Header: ({ children }: { children: React.ReactNode[] }) => <nav>{children}</nav>,
}));
vi.mock('../CreateButton', () => ({ CreateButton: () => null }));
vi.mock('../Modals/AppSettings', () => ({ AppSettings: () => null, SettingsTab: {} }));
vi.mock('../Modals/About', () => ({ About: () => null }));
vi.mock('./LogoMenu', () => ({ LogoMenu: () => null }));

const renderNavbar = (active: NavbarItem) =>
  render(
    <Provider store={createTestStore()}>
      <MemoryRouter>
        <Navbar active={active} />
      </MemoryRouter>
    </Provider>,
  );

describe('Navbar', () => {
  beforeAll(() => {
    setCurrentLocale('en', flatten(en));
  });

  afterEach(() => {
    cleanup();
  });

  describe('when it renders', () => {
    it('should list the seven sections in order', () => {
      renderNavbar(NavbarItem.HOME);
      expect(screen.getAllByRole('link').map(link => link.textContent)).toEqual([
        'Home',
        'Scenes',
        'Templates',
        'Analytics',
        'Manage',
        'Learn',
        'More',
      ]);
    });

    it('should link Templates to the templates page', () => {
      renderNavbar(NavbarItem.HOME);
      expect(screen.getByRole('link', { name: 'Templates' }).getAttribute('href')).toBe(
        '/templates',
      );
    });
  });

  describe('when a section is active', () => {
    it('should mark only that section as the current page', () => {
      renderNavbar(NavbarItem.TEMPLATES);
      const current = screen
        .getAllByRole('link')
        .filter(link => link.getAttribute('aria-current') === 'page');
      expect(current.map(link => link.textContent)).toEqual(['Templates']);
    });
  });
});
