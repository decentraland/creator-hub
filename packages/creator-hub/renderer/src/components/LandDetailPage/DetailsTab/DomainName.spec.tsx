import { Provider } from 'react-redux';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { flatten } from 'flat';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { dark, ThemeProvider } from 'decentraland-ui2/dist/theme';

import { useAuth } from '/@/hooks/useAuth';
import { LandType, RoleType, type Land } from '/@/lib/land';
import { toLandProject } from '/@/modules/store/management/utils';
import { en } from '/@/modules/store/translation/locales';
import { setCurrentLocale } from '/@/modules/store/translation/utils';

import { createTestStore } from '../../../../tests/utils/testStore';
import { DomainName } from './DomainName';

vi.mock('/@/hooks/useAuth', () => ({ useAuth: vi.fn() }));
vi.mock('/@/lib/ens', async importOriginal => ({
  ...(await importOriginal<object>()),
  LandRedirections: class {
    fetchHashes = async () => ({ '0xaaa': '96,15' });
  },
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
  description: null,
  owner: '0xme',
  operators: [],
  updateOperator: null,
};

describe('DomainName', () => {
  beforeAll(() => {
    setCurrentLocale('en', flatten(en));
  });

  afterEach(cleanup);

  describe('when a linked NAME is being changed', () => {
    it('should paint Remove link in the error colour, as a destructive item', async () => {
      vi.mocked(useAuth).mockReturnValue({ wallet: '0xme' } as unknown as ReturnType<
        typeof useAuth
      >);
      const store = createTestStore();
      store.dispatch({
        type: 'ens/fetchENSList/fulfilled',
        payload: [
          {
            subdomain: 'plaza.dcl.eth',
            nftOwnerAddress: '0xme',
            provider: 'dcl',
            content: '0xaaa',
          },
        ],
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

      fireEvent.click(screen.getByRole('button', { name: 'Change Domain Name' }));

      expect(
        getComputedStyle(await screen.findByRole('option', { name: 'Remove link' })).color,
      ).toBe('#FB3B3B');
    });
  });
});
