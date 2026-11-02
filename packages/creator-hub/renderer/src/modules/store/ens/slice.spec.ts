import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';

import type * as Viem from 'viem';
import { USER_PERMISSIONS } from './types';

const SELF = '0x0000000000000000000000000000000000000abc';
const RESOLVER = '0x0000000000000000000000000000000000000def';
const CONTENT = '0xe30101701220aaaa';

const readContractMock = vi.fn();
const fetchDCLNamesMock = vi.fn();
const fetchDCLOwnersMock = vi.fn();
const fetchContributableDomainsMock = vi.fn();

vi.mock('/@/config', () => ({
  config: {
    get: (key: string) =>
      ({
        CHAIN_ID: '11155111',
        RPC_URL: 'https://rpc.example.org/sepolia',
        DCL_LISTS_URL: 'https://lists.example.org',
      })[key],
  },
}));

vi.mock('viem', async importOriginal => ({
  ...(await importOriginal<typeof Viem>()),
  createPublicClient: () => ({ readContract: readContractMock }),
}));

vi.mock('/shared/fetch', () => ({
  fetch: async () => ({ ok: true, json: async () => ({ data: [] }) }),
}));

vi.mock('/@/lib/ens', () => ({
  DCLNames: class {
    fetchNames = fetchDCLNamesMock;
    fetchNamesOwners = fetchDCLOwnersMock;
  },
  ENS: class {
    fetchNames = async () => [];
    fetchNamesOwners = async () => ({});
  },
}));

vi.mock('/@/lib/worlds', () => ({
  Worlds: class {
    fetchContributableDomains = fetchContributableDomainsMock;
  },
}));

const { fetchENSList, slice } = await import('./slice');

const onChain: Record<string, unknown> = {
  resolver: RESOLVER,
  owner: SELF,
  getTokenId: 1n,
  addr: '0x0000000000000000000000000000000000000000',
  contenthash: CONTENT,
};

describe('fetchENSList', () => {
  let store: ReturnType<typeof configureStore<{ ens: ReturnType<typeof slice.reducer> }>>;

  beforeEach(() => {
    readContractMock.mockImplementation(async ({ functionName }) => onChain[functionName]);
    store = configureStore({ reducer: { ens: slice.reducer } });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('when the wallet owns a NAME and is also on its World deployment allow-list', () => {
    beforeEach(() => {
      fetchDCLNamesMock.mockResolvedValueOnce(['fixtureone.dcl.eth']);
      fetchDCLOwnersMock.mockResolvedValueOnce({ fixtureone: SELF, fixturetwo: '0xother' });
      fetchContributableDomainsMock.mockResolvedValueOnce([
        {
          name: 'fixtureone.dcl.eth',
          user_permissions: [USER_PERMISSIONS.DEPLOYMENT],
          owner: SELF,
          size: '10',
        },
        {
          name: 'fixturetwo.dcl.eth',
          user_permissions: [USER_PERMISSIONS.DEPLOYMENT],
          owner: '0xother',
          size: '20',
        },
      ]);
    });

    it("should keep the owned entry's on-chain records", async () => {
      await store.dispatch(fetchENSList({ address: SELF }) as never);

      expect(store.getState().ens.data['fixtureone.dcl.eth']).toMatchObject({
        ensOwnerAddress: SELF,
        resolver: RESOLVER,
        content: CONTENT,
      });
    });

    it('should list the owned NAME once', async () => {
      const list = await store.dispatch(fetchENSList({ address: SELF }) as never).unwrap();

      expect(
        list.filter(({ subdomain }: { subdomain: string }) => subdomain === 'fixtureone.dcl.eth'),
      ).toHaveLength(1);
    });

    it('should keep the NAMEs it can only contribute to', async () => {
      await store.dispatch(fetchENSList({ address: SELF }) as never);

      expect(store.getState().ens.data['fixturetwo.dcl.eth']).toMatchObject({
        nftOwnerAddress: '0xother',
        userPermissions: [USER_PERMISSIONS.DEPLOYMENT],
        size: '20',
      });
    });
  });
});
