import { Provider } from 'react-redux';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { flatten } from 'flat';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { dark, ThemeProvider } from 'decentraland-ui2/dist/theme';

import { useAuth } from '/@/hooks/useAuth';
import { LandType, RoleType, type Land } from '/@/lib/land';
import { buildUpdateLandMetadata, sendLandTransaction } from '/@/lib/landTransactions';
import { toLandProject } from '/@/modules/store/management/utils';
import { en } from '/@/modules/store/translation/locales';
import { setCurrentLocale } from '/@/modules/store/translation/utils';

import { createTestStore } from '../../../../tests/utils/testStore';
import { DetailsTab } from '.';

vi.mock('/@/hooks/useAuth', () => ({ useAuth: vi.fn() }));
vi.mock('/@/lib/ens', async importOriginal => ({
  ...(await importOriginal<object>()),
  LandRedirections: class {
    fetchHashes = async () => ({});
  },
}));
vi.mock('/@/lib/landTransactions', async importOriginal => ({
  ...(await importOriginal<object>()),
  sendLandTransaction: vi.fn(() => new Promise(() => {})),
}));

const land: Land = {
  id: '96,15',
  tokenId: '1',
  type: LandType.PARCEL,
  roles: [RoleType.OWNER],
  role: RoleType.OWNER,
  x: 96,
  y: 15,
  name: 'Land Name',
  description: 'A square',
  owner: '0xme',
  operators: [],
  updateOperator: null,
};

let slot: HTMLDivElement;

function renderTab(mode: 'edit' | 'read', subject: Land = land) {
  vi.mocked(useAuth).mockReturnValue({ wallet: '0xme' } as unknown as ReturnType<typeof useAuth>);
  slot = document.createElement('div');
  document.body.appendChild(slot);
  render(
    <Provider store={createTestStore() as never}>
      <ThemeProvider theme={dark}>
        <DetailsTab
          land={subject}
          project={toLandProject(subject, [], hash => hash)}
          mode={mode}
          actionsSlot={slot}
        />
      </ThemeProvider>
    </Provider>,
  );
}

const nameField = () => screen.getByRole('textbox', { name: 'Land Name' });

describe('DetailsTab', () => {
  beforeAll(() => {
    setCurrentLocale('en', flatten(en));
  });

  afterEach(() => {
    cleanup();
    slot.remove();
  });

  describe('when an editor opens it', () => {
    beforeEach(() => renderTab('edit'));

    it('should fill the fields and block Save until something changes', () => {
      expect(nameField()).toHaveProperty('value', 'Land Name');
      expect(screen.getByRole('button', { name: 'Save' })).toHaveProperty('disabled', true);
      expect(screen.queryByRole('button', { name: 'Discard' })).toBeNull();
      expect(screen.getByText('9/50')).toBeTruthy();
    });

    it('should enable Save once edited, and Discard should restore the values', () => {
      fireEvent.change(nameField(), { target: { value: 'Plaza' } });

      expect(screen.getByRole('button', { name: 'Save' })).toHaveProperty('disabled', false);
      fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
      expect(nameField()).toHaveProperty('value', 'Land Name');
    });

    it('should keep what was typed past the limit, flag it and block Save', () => {
      fireEvent.change(nameField(), { target: { value: 'x'.repeat(51) } });

      expect(nameField()).toHaveProperty('value', 'x'.repeat(51));
      expect(screen.getByText('51/50')).toBeTruthy();
      expect(screen.getByText('Use 50 characters or fewer.')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Save' })).toHaveProperty('disabled', true);
    });

    it('should save name and description together in one transaction', async () => {
      fireEvent.change(nameField(), { target: { value: 'Plaza' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      expect(screen.getByRole('dialog', { name: 'Save details' })).toBeTruthy();

      await act(async () => {
        fireEvent.click(screen.getAllByRole('button', { name: 'Save' }).at(-1)!);
      });

      expect(vi.mocked(sendLandTransaction).mock.calls[0][0]).toEqual(
        buildUpdateLandMetadata(land, 'Plaza', 'A square'),
      );
    });

    it('should offer to claim a NAME when the account owns none', () => {
      expect(screen.getByRole('link', { name: 'Claim a NAME' })).toBeTruthy();
    });

    it('should show the Domain Name field disabled, with its placeholder, when the account owns no NAMEs', () => {
      const domain = screen.getByRole('combobox', { name: 'Domain Name' });

      expect(domain.getAttribute('aria-disabled')).toBe('true');
      expect(domain.textContent).toBe('Choose a NAME');
    });
  });

  describe('when an editor opens an unnamed LAND', () => {
    beforeEach(() => renderTab('edit', { ...land, name: '', description: null }));

    it('should not ask for a name before anything was edited', () => {
      expect(screen.queryByText('Enter a name.')).toBeNull();
    });

    it('should ask for a name once an edit would need it to save', () => {
      fireEvent.change(screen.getByRole('textbox', { name: 'Description' }), {
        target: { value: 'A square' },
      });

      expect(screen.getByText('Enter a name.')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Save' })).toHaveProperty('disabled', true);
    });
  });

  describe('when an editor clears the name', () => {
    it('should ask for a name', () => {
      renderTab('edit');
      fireEvent.change(nameField(), { target: { value: '' } });

      expect(screen.getByText('Enter a name.')).toBeTruthy();
    });
  });

  describe('when a tenant opens an unnamed LAND without a description', () => {
    it('should show a dash for each empty value', () => {
      renderTab('read', { ...land, name: '', description: null });

      expect(screen.getAllByRole('definition').map(value => value.textContent)).toEqual(['—', '—']);
    });
  });

  describe('when a tenant opens it', () => {
    it('should show the details as text, with nothing to save', () => {
      renderTab('read');

      expect(screen.queryByRole('textbox', { name: 'Land Name' })).toBeNull();
      expect(screen.getByText('Land Name', { selector: 'dd' })).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
    });
  });
});
