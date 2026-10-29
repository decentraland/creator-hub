import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { flatten } from 'flat';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { dark, ThemeProvider } from 'decentraland-ui2/dist/theme';

import { useAuth } from '/@/hooks/useAuth';
import { LandType, RoleType, type Land } from '/@/lib/land';
import { buildUpdateLandMetadata, sendLandTransaction } from '/@/lib/landTransactions';
import { actions as ensActions } from '/@/modules/store/ens';
import { ENSProvider, type ENS } from '/@/modules/store/ens/types';
import { toLandProject } from '/@/modules/store/management/utils';
import { en } from '/@/modules/store/translation/locales';
import { setCurrentLocale } from '/@/modules/store/translation/utils';
import { pollUntil } from '/shared/utils';

import { createTestStore } from '../../../../tests/utils/testStore';
import { DetailShell } from '../../DetailShell';
import { DetailsTab } from '.';

vi.mock('/@/hooks/useAuth', () => ({ useAuth: vi.fn() }));
vi.mock('/@/lib/ens', async importOriginal => ({
  ...(await importOriginal<object>()),
  LandRedirections: class {
    fetchHashes = async () => ({});
    create = async () => REDIRECT_HASH;
  },
}));
vi.mock('/@/modules/store/ens', async importOriginal => ({
  ...(await importOriginal<object>()),
  fetchENSList: () => ({ type: 'test/fetchENSList' }),
}));
vi.mock('/shared/utils', async importOriginal => ({
  ...(await importOriginal<object>()),
  pollUntil: vi.fn(async (check: () => Promise<boolean>) => check()),
}));

const REDIRECT_HASH = `0x${'cd'.repeat(32)}`;
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

function renderTab(mode: 'edit' | 'read', subject: Land = land, store = createTestStore()) {
  vi.mocked(useAuth).mockReturnValue({ wallet: '0xme' } as unknown as ReturnType<typeof useAuth>);
  render(
    <Provider store={store as never}>
      <MemoryRouter>
        <ThemeProvider theme={dark}>
          <DetailShell
            title="Manage - Land Name"
            basePath="/manage/land/96%2C15"
            menu={null}
            tabs={[{ value: 'details', label: 'Details' }]}
            activeTab="details"
          >
            <DetailsTab
              land={subject}
              project={toLandProject(subject, [], hash => hash)}
              mode={mode}
            />
          </DetailShell>
        </ThemeProvider>
      </MemoryRouter>
    </Provider>,
  );
}

const nameField = () => screen.getByRole('textbox', { name: 'Land Name' });

describe('DetailsTab', () => {
  beforeAll(() => {
    setCurrentLocale('en', flatten(en));
  });

  afterEach(cleanup);

  describe('when an editor opens it', () => {
    beforeEach(() => renderTab('edit'));

    it('should fill the fields and show neither CANCEL nor SAVE until something changes', () => {
      expect(nameField()).toHaveProperty('value', 'Land Name');
      expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
      expect(screen.getByText('9/50')).toBeTruthy();
    });

    it('should show CANCEL and an enabled SAVE once edited, and CANCEL should restore the values', () => {
      fireEvent.change(nameField(), { target: { value: 'Plaza' } });

      expect(screen.getByRole('button', { name: 'Save' })).toHaveProperty('disabled', false);
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(nameField()).toHaveProperty('value', 'Land Name');
      expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
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

    it('should show no Domain Name field, only the link to claim a NAME, when the account owns no NAMEs', () => {
      expect(screen.queryByRole('combobox', { name: 'Domain Name' })).toBeNull();
      expect(screen.getByRole('link', { name: 'Claim a NAME' }).getAttribute('href')).toBe(
        'https://decentraland.org/marketplace/names/claim',
      );
    });
  });

  describe('when an editor links a NAME to the LAND', () => {
    it('should stop refetching once the NAME points at the new redirect', async () => {
      const name: ENS = {
        name: 'plaza',
        subdomain: 'plaza',
        provider: ENSProvider.DCL,
        nftOwnerAddress: '0xme',
        ensOwnerAddress: '0xme',
        tokenId: '1',
        resolver: '0x0000000000000000000000000000000000000001',
        content: REDIRECT_HASH,
      };
      const store = createTestStore();
      store.dispatch(ensActions.fetchENSList.fulfilled([name], 'test', { address: '0xme' }));
      vi.mocked(sendLandTransaction).mockResolvedValueOnce({
        hash: `0x${'ab'.repeat(32)}`,
        status: 'confirmed',
      });
      vi.mocked(pollUntil).mockClear();
      renderTab('edit', land, store);

      fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Domain Name' }));
      fireEvent.click(screen.getByRole('option', { name: 'plaza' }));
      await act(async () => {
        fireEvent.click(screen.getAllByRole('button', { name: 'Set Domain Name' }).at(-1)!);
      });

      expect(await vi.mocked(pollUntil).mock.results[0]?.value).toBe(true);
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
