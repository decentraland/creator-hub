import { Provider } from 'react-redux';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { flatten } from 'flat';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { zeroAddress } from 'viem';
import { dark, ThemeProvider } from 'decentraland-ui2/dist/theme';

import { useAuth } from '/@/hooks/useAuth';
import { LandType, RoleType, type Land } from '/@/lib/land';
import { sendLandTransaction } from '/@/lib/landTransactions';
import { buildLinkName, encodeLandRedirect } from '/@/modules/store/ens/names';
import { fetchLandList } from '/@/modules/store/land/slice';
import { toLandProject } from '/@/modules/store/management/utils';
import { en } from '/@/modules/store/translation/locales';
import { setCurrentLocale } from '/@/modules/store/translation/utils';

import { createTestStore } from '../../../../tests/utils/testStore';
import { DomainName } from './DomainName';

vi.mock('/@/hooks/useAuth', () => ({ useAuth: vi.fn() }));
vi.mock('/@/lib/landTransactions', async importOriginal => ({
  ...(await importOriginal<object>()),
  sendLandTransaction: vi.fn(() => new Promise(() => {})),
}));

const RESOLVER = '0x1234567890123456789012345678901234567890';

const land: Land = {
  id: '96,15',
  tokenId: '1',
  type: LandType.PARCEL,
  roles: [RoleType.OWNER],
  role: RoleType.OWNER,
  x: 96,
  y: 15,
  name: 'Land Name',
  description: null,
  owner: '0xme',
  operators: [],
  updateOperator: null,
};

type Name = { subdomain: string; resolver: string; content: string };

async function renderField(names: Name[]) {
  vi.mocked(useAuth).mockReturnValue({ wallet: '0xme' } as unknown as ReturnType<typeof useAuth>);
  const store = createTestStore();
  store.dispatch(
    fetchLandList.fulfilled({ land: [land], authorizations: [], rentals: [] }, 'r', {
      address: '0xme',
    }),
  );
  store.dispatch({
    type: 'ens/fetchENSList/fulfilled',
    payload: names.map(name => ({ ...name, nftOwnerAddress: '0xme', provider: 'dcl' })),
  });
  render(
    <Provider store={store as never}>
      <ThemeProvider theme={dark}>
        <DomainName
          land={land}
          project={toLandProject(land, [], hash => hash)}
        />
      </ThemeProvider>
    </Provider>,
  );
  await act(async () => {});
}

const sent = () => vi.mocked(sendLandTransaction).mock.calls.map(([tx]) => tx);

const link = async (subdomain: string) => {
  fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Domain Name' }));
  fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: subdomain }));
  await act(async () =>
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Set Domain Name' }),
    ),
  );
};

describe('DomainName', () => {
  const fetchSpy = vi.fn();

  beforeAll(() => {
    setCurrentLocale('en', flatten(en));
  });

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    fetchSpy.mockReset();
    vi.mocked(sendLandTransaction).mockClear();
  });

  describe('when a NAME with a resolver is linked', () => {
    it('should write the jump URL to its contenthash in one transaction, calling no server', async () => {
      await renderField([{ subdomain: 'plaza.dcl.eth', resolver: RESOLVER, content: '' }]);

      await link('plaza.dcl.eth');

      expect(sent()).toEqual(
        buildLinkName(
          { subdomain: 'plaza.dcl.eth', resolver: RESOLVER },
          encodeLandRedirect({ x: 96, y: 15 }),
        ).slice(0, 1),
      );
      expect(screen.queryByText(/^Step /)).toBeNull();
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe('when a NAME with no resolver is linked', () => {
    it('should set its resolver first, as step 1 of 2', async () => {
      await renderField([{ subdomain: 'plaza.dcl.eth', resolver: zeroAddress, content: '' }]);

      await link('plaza.dcl.eth');

      const [setResolver] = buildLinkName(
        { subdomain: 'plaza.dcl.eth', resolver: zeroAddress },
        encodeLandRedirect({ x: 96, y: 15 }),
      );
      expect(sent()).toEqual([setResolver]);
      expect(screen.getByText('Step 1 of 2 · Set up NAME')).toBeTruthy();
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe('when a linked NAME is being changed', () => {
    beforeEach(async () => {
      await renderField([
        {
          subdomain: 'plaza.dcl.eth',
          resolver: RESOLVER,
          content: encodeLandRedirect({ x: 96, y: 15 }),
        },
      ]);
      fireEvent.click(screen.getByRole('button', { name: 'Change Domain Name' }));
    });

    it('should paint Remove link in the error colour, as a destructive item', async () => {
      expect(
        getComputedStyle(await screen.findByRole('option', { name: 'Remove link' })).color,
      ).toBe('#FB3B3B');
    });

    it('should clear the contenthash on Remove link', async () => {
      fireEvent.click(await screen.findByRole('option', { name: 'Remove link' }));
      await act(async () =>
        fireEvent.click(
          within(screen.getByRole('dialog')).getByRole('button', { name: 'Remove link' }),
        ),
      );

      expect(sent()).toEqual(
        buildLinkName({ subdomain: 'plaza.dcl.eth', resolver: RESOLVER }, '0x'),
      );
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });
});
