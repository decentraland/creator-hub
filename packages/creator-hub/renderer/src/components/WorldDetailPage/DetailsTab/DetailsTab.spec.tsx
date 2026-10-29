import type { ButtonHTMLAttributes } from 'react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { flatten } from 'flat';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { dark, ThemeProvider } from 'decentraland-ui2/dist/theme';

import type { WorldSettings } from '/@/lib/worlds';
import type * as WorldsModule from '/@/lib/worlds';
import { en } from '/@/modules/store/translation/locales';
import { setCurrentLocale } from '/@/modules/store/translation/utils';

import { createTestStore } from '../../../../tests/utils/testStore';
import { DetailShell } from '../../DetailShell';
import { DetailsTab } from '.';

const fetchWorldSettings = vi.fn();
const putWorldSettings = vi.fn();

vi.mock('/@/lib/worlds', async importOriginal => {
  const original = await importOriginal<typeof WorldsModule>();
  return {
    ...original,
    Worlds: class {
      fetchWorldSettings = (name: string) => fetchWorldSettings(name);
      putWorldSettings = (...args: unknown[]) => putWorldSettings(...args);
      fetchWorlds = async () => ({ worlds: [], total: 0 });
    },
  };
});
vi.mock('/@/lib/auth', async importOriginal => ({
  ...(await importOriginal<object>()),
  AuthServerProvider: { getAccount: () => '0xme' },
}));
vi.mock('../../Button', async importOriginal => ({
  ...(await importOriginal<object>()),
  Button: ({
    variant: _variant,
    color: _color,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; color?: string }) => (
    <button
      type="button"
      {...props}
    />
  ),
}));

const saved: WorldSettings = {
  title: 'Plaza',
  description: 'A square',
  categories: ['social' as never, 'music' as never],
  thumbnail: 'https://content.example/thumb.png',
};

async function renderTab(settings: WorldSettings = saved) {
  fetchWorldSettings.mockResolvedValue(settings);
  putWorldSettings.mockResolvedValue({ success: true });
  const store = createTestStore();
  render(
    <Provider store={store as never}>
      <MemoryRouter>
        <ThemeProvider theme={dark}>
          <DetailShell
            title="Manage - Plaza"
            basePath="/manage/world/plaza.dcl.eth"
            menu={null}
            tabs={[{ value: 'details', label: 'Details' }]}
            activeTab="details"
          >
            <DetailsTab worldName="plaza.dcl.eth" />
          </DetailShell>
        </ThemeProvider>
      </MemoryRouter>
    </Provider>,
  );
  await screen.findByRole('textbox', { name: 'World Name' });
  return store;
}

const notices = (store: ReturnType<typeof createTestStore>) =>
  store
    .getState()
    .snackbar.notifications.map(notice =>
      notice.type === 'generic' ? `${notice.severity}: ${notice.message}` : notice.type,
    );

const nameField = () => screen.getByRole('textbox', { name: 'World Name' });
const descriptionField = () => screen.getByRole('textbox', { name: 'Description' });
const categories = () => screen.getByRole('combobox', { name: 'Categories' });
const byText = (elements: HTMLElement[], text: string) =>
  elements.find(element => element.textContent === text)!;
const edit = (field: HTMLElement, value: string) => fireEvent.change(field, { target: { value } });

describe('World DetailsTab', () => {
  beforeAll(() => {
    setCurrentLocale('en', flatten(en));
  });

  afterEach(() => {
    cleanup();
    fetchWorldSettings.mockReset();
    putWorldSettings.mockReset();
  });

  describe('when the owner opens it', () => {
    it('should fill World Name and Description with their placeholders and counters', async () => {
      await renderTab();

      expect(fetchWorldSettings).toHaveBeenCalledWith('plaza.dcl.eth');
      expect(nameField()).toHaveProperty('value', 'Plaza');
      expect(nameField().getAttribute('placeholder')).toBe('Write here');
      expect(descriptionField()).toHaveProperty('value', 'A square');
      expect(descriptionField().getAttribute('placeholder')).toBe(
        'Write something about your world here',
      );
      expect(screen.getByText('5/50')).toBeTruthy();
      expect(screen.getByText('8/140')).toBeTruthy();
    });

    it('should show the categories and the thumbnail, with neither CANCEL nor SAVE', async () => {
      await renderTab();

      expect(categories().textContent).toBe('👥 Social, 🎶 Music');
      expect(screen.getByRole('img', { name: 'Thumbnail' }).getAttribute('src')).toBe(
        'https://content.example/thumb.png',
      );
      expect(screen.getByText('PNG or JPG | 1920x1080 (16:9)')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Change thumbnail' })).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
    });
  });

  describe('when the World has no thumbnail', () => {
    it('should say so in the image box, keeping the edit button', async () => {
      await renderTab({ ...saved, thumbnail: undefined });

      expect(screen.getByText('No image set')).toBeTruthy();
      expect(screen.queryByRole('img', { name: 'Thumbnail' })).toBeNull();
      expect(screen.getByRole('button', { name: 'Change thumbnail' })).toBeTruthy();
    });
  });

  describe('when a field is edited', () => {
    it('should show CANCEL and SAVE, and CANCEL should restore the saved values', async () => {
      await renderTab();
      edit(nameField(), 'Fixture Plaza');

      expect(screen.getByRole('button', { name: 'Save' })).toHaveProperty('disabled', false);
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(nameField()).toHaveProperty('value', 'Plaza');
      expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
    });

    it('should save only the edited fields', async () => {
      await renderTab();
      edit(nameField(), 'Fixture Plaza');

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      });

      expect(putWorldSettings).toHaveBeenCalledWith('0xme', 'plaza.dcl.eth', {
        title: 'Fixture Plaza',
      });
    });

    it('should confirm a successful save', async () => {
      const store = await renderTab();
      edit(nameField(), 'Fixture Plaza');

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      });

      expect(notices(store)).toContain('success: Changes saved');
    });

    it('should report a failed save with the existing error, and not confirm it', async () => {
      const store = await renderTab();
      putWorldSettings.mockResolvedValue({ success: false, error: 'Fixture failure' });
      edit(nameField(), 'Fixture Plaza');

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      });

      expect(notices(store)).toContain('error: Fixture failure');
      expect(notices(store)).not.toContain('success: Changes saved');
    });

    it('should block SAVE over a limit and say so', async () => {
      await renderTab();
      edit(descriptionField(), 'x'.repeat(141));

      expect(screen.getByText('141/140')).toBeTruthy();
      expect(screen.getByText('Use 140 characters or fewer.')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Save' })).toHaveProperty('disabled', true);
    });
  });

  describe('when the World already has a name over the limit', () => {
    it('should open in the error state, with SAVE blocked until the name fits', async () => {
      await renderTab({ ...saved, title: 'x'.repeat(51) });

      expect(screen.getByText('Use 50 characters or fewer.')).toBeTruthy();

      edit(descriptionField(), 'A bigger square');
      expect(screen.getByRole('button', { name: 'Save' })).toHaveProperty('disabled', true);

      edit(nameField(), 'Plaza');
      expect(screen.getByRole('button', { name: 'Save' })).toHaveProperty('disabled', false);
    });
  });

  describe('when categories are picked', () => {
    it('should add the picked one, and save the new set', async () => {
      await renderTab();
      const field = categories();
      fireEvent.mouseDown(field);
      fireEvent.click(byText(within(screen.getByRole('listbox')).getAllByRole('option'), '🎨 Art'));

      expect(field.textContent).toBe('👥 Social, 🎶 Music, 🎨 Art');

      await act(async () => {
        fireEvent.click(byText(screen.getAllByRole('button', { hidden: true }), 'Save'));
      });

      expect(putWorldSettings).toHaveBeenCalledWith('0xme', 'plaza.dcl.eth', {
        categories: ['social', 'music', 'art'],
      });
    });

    it('should check the selected categories, keeping a checkmark slot on every row', async () => {
      await renderTab();
      fireEvent.mouseDown(categories());
      const option = (name: string) =>
        within(screen.getByRole('listbox')).getByRole('option', { name });

      expect(option('👥 Social').querySelector('[data-testid="CheckIcon"]')).not.toBeNull();
      expect(option('🎶 Music').querySelector('[data-testid="CheckIcon"]')).not.toBeNull();
      expect(option('🎨 Art').querySelector('[data-testid="CheckIcon"]')).toBeNull();
      expect(option('🎨 Art').querySelector('.MenuGlyph')).not.toBeNull();
    });

    it('should not offer a fourth category', async () => {
      await renderTab({ ...saved, categories: ['social', 'music', 'art'] as never });
      fireEvent.mouseDown(categories());

      expect(
        within(screen.getByRole('listbox'))
          .getByRole('option', { name: '🕹️ Game' })
          .getAttribute('aria-disabled'),
      ).toBe('true');
    });
  });
});
