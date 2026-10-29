import { useState } from 'react';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { flatten } from 'flat';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { dark, ThemeProvider } from 'decentraland-ui2/dist/theme';

import { en } from '/@/modules/store/translation/locales';
import { setCurrentLocale } from '/@/modules/store/translation/utils';

import { createTestStore } from '../../../tests/utils/testStore';
import { DetailShell, useDraft } from '.';

const onSave = vi.fn();
const onCancel = vi.fn();

function Form() {
  const [value, setValue] = useState('Plaza');
  useDraft({
    dirty: value !== 'Plaza',
    valid: value !== '',
    onCancel: () => {
      onCancel();
      setValue('Plaza');
    },
    onSave,
  });
  return (
    <input
      aria-label="Field"
      value={value}
      onChange={event => setValue(event.target.value)}
    />
  );
}

function Shell() {
  const { tab = 'details' } = useParams();
  return (
    <DetailShell
      title="Manage - Plaza"
      basePath="/manage/land/96%2C15"
      menu={<button>Options</button>}
      tabs={[
        { value: 'details', label: 'Details' },
        { value: 'scenes', label: 'Scenes' },
      ]}
      activeTab={tab}
    >
      {tab === 'details' ? <Form /> : <p>scenes panel</p>}
    </DetailShell>
  );
}

function Where() {
  return <output aria-label="location">{useLocation().pathname}</output>;
}

function renderShell() {
  render(
    <Provider store={createTestStore() as never}>
      <MemoryRouter initialEntries={['/manage/land/96%2C15/details']}>
        <ThemeProvider theme={dark}>
          <Routes>
            <Route
              path="/manage/land/:id/:tab?"
              element={<Shell />}
            />
            <Route
              path="/manage"
              element={<p>manage page</p>}
            />
          </Routes>
          <Where />
        </ThemeProvider>
      </MemoryRouter>
    </Provider>,
  );
}

const field = () => screen.getByRole('textbox', { name: 'Field' });
const edit = (value: string) => fireEvent.change(field(), { target: { value } });
const location = () => screen.getByRole('status', { name: 'location', hidden: true }).textContent;
const guard = () =>
  screen.queryByRole('dialog', { name: 'You have unsaved changes. Save before leaving?' });

describe('DetailShell', () => {
  beforeAll(() => {
    setCurrentLocale('en', flatten(en));
  });

  afterEach(() => {
    cleanup();
    onSave.mockReset();
    onCancel.mockReset();
  });

  describe('when nothing has changed', () => {
    it('should show neither CANCEL nor SAVE, only the menu', () => {
      renderShell();

      expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
      expect(screen.getByRole('button', { name: 'Options' })).toBeTruthy();
    });

    it('should switch tabs and go back without asking', () => {
      renderShell();

      fireEvent.click(screen.getByRole('tab', { name: 'Scenes' }));
      expect(location()).toBe('/manage/land/96%2C15/scenes');

      fireEvent.click(screen.getByRole('button', { name: 'Back' }));
      expect(location()).toBe('/manage');
    });
  });

  describe('when a field changes', () => {
    it('should show CANCEL then SAVE before the menu', () => {
      renderShell();
      edit('Fixture Plaza');

      const buttons = screen.getAllByRole('button').map(button => button.textContent);
      expect(buttons.slice(buttons.indexOf('Cancel'), buttons.indexOf('Options') + 1)).toEqual([
        'Cancel',
        'Save',
        'Options',
      ]);
    });

    it('should reset the field and hide both on CANCEL', () => {
      renderShell();
      edit('Fixture Plaza');

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(field()).toHaveProperty('value', 'Plaza');
      expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
    });

    it('should block SAVE while the field is invalid, and hand SAVE to the tab once valid', () => {
      renderShell();
      edit('');

      expect(screen.getByRole('button', { name: 'Save' })).toHaveProperty('disabled', true);

      edit('Fixture Plaza');
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      expect(onSave).toHaveBeenCalledTimes(1);
    });
  });

  describe('when leaving a tab with changes', () => {
    it('should ask first, and DISCARD should drop the changes and switch', () => {
      renderShell();
      edit('Fixture Plaza');

      fireEvent.click(screen.getByRole('tab', { name: 'Scenes' }));

      expect(guard()).toBeTruthy();
      expect(location()).toBe('/manage/land/96%2C15/details');

      fireEvent.click(screen.getByRole('button', { name: 'Discard' }));

      expect(onCancel).toHaveBeenCalled();
      expect(location()).toBe('/manage/land/96%2C15/scenes');
    });

    it('should save and stay on SAVE', async () => {
      renderShell();
      edit('Fixture Plaza');
      fireEvent.click(screen.getByRole('tab', { name: 'Scenes' }));

      fireEvent.click(screen.getAllByRole('button', { name: 'Save' }).at(-1)!);

      expect(onSave).toHaveBeenCalledTimes(1);
      expect(location()).toBe('/manage/land/96%2C15/details');
      await waitFor(() => expect(guard()).toBeNull());
    });

    it('should stay, keeping the changes, when the question is dismissed', async () => {
      renderShell();
      edit('Fixture Plaza');
      fireEvent.click(screen.getByRole('tab', { name: 'Scenes' }));

      act(() => {
        fireEvent.keyDown(guard()!, { key: 'Escape' });
      });

      await waitFor(() => expect(guard()).toBeNull());
      expect(location()).toBe('/manage/land/96%2C15/details');
      expect(field()).toHaveProperty('value', 'Fixture Plaza');
    });
  });

  describe('when leaving the page with changes', () => {
    it('should ask first, then go back to Manage on DISCARD', () => {
      renderShell();
      edit('Fixture Plaza');

      fireEvent.click(screen.getByRole('button', { name: 'Back' }));
      expect(guard()).toBeTruthy();

      fireEvent.click(screen.getByRole('button', { name: 'Discard' }));

      expect(location()).toBe('/manage');
    });
  });
});
