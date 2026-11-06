import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BaseError,
  ContractFunctionRevertedError,
  encodeErrorResult,
  parseAbi,
  zeroAddress,
} from 'viem';
import { mainnet, sepolia } from 'viem/chains';
import type * as Viem from 'viem';
import { ChainId } from '@dcl/schemas/dist/dapps/chain-id';
import type * as SharedFetch from '/shared/fetch';
import type * as EnsLib from '/@/lib/ens';
import { FilterBy } from '/shared/types/manage';
import { createTestStore } from '../../../../tests/utils/testStore';
import { accountChanged } from '../account';
import { actions as managementActions, fetchManagedProjectsFiltered } from '../management';
import { ens as ensContract, dclRegistrar } from './contracts';
import { actions, fetchDCLNames, fetchENSList, slice } from './slice';
import { resolveContent } from './resolveContent';
import type * as ResolveContent from './resolveContent';
import { ENS_RECORD_TIMEOUT_MS } from './ccipRead';
import type { ENS } from './types';
import { USER_PERMISSIONS } from './types';

vi.mock('./resolveContent', async importOriginal => ({
  ...(await importOriginal<typeof ResolveContent>()),
  resolveContent: vi.fn(),
}));

const OWNER = '0x1111111111111111111111111111111111111111';
const CURRENT_RESOLVER = '0x2222222222222222222222222222222222222222';
const RECORD_ADDRESS = '0x3333333333333333333333333333333333333333';
const CONTENT_HASH = '0xe301017012201234';
const UNIVERSAL_RESOLVER = '0xeeeeeeee14d718c2b47d9923deab1335e144eeee';

const getEnsAddressMock = vi.fn();
const registryResolverMock = vi.fn();

const getContractMock = vi.fn();
const fetchNamesMock = vi.fn();
const fetchNamesOwnersMock = vi.fn();
const fetchContributableDomainsMock = vi.fn();
const fetchMock = vi.fn();

vi.mock('viem', async importOriginal => ({
  ...(await importOriginal<typeof Viem>()),
  createPublicClient: () => ({ getEnsAddress: getEnsAddressMock }),
  getContract: (params: { address: string }) => getContractMock(params),
}));

vi.mock('/@/lib/ens', async importOriginal => ({
  ...(await importOriginal<typeof EnsLib>()),
  DCLNames: class {
    fetchNames = fetchNamesMock;
    fetchNamesOwners = fetchNamesOwnersMock;
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

vi.mock('/@/lib/auth', () => ({ AuthServerProvider: { getAccount: () => OWNER } }));

vi.mock('/shared/fetch', async importOriginal => ({
  ...(await importOriginal<typeof SharedFetch>()),
  fetch: (...args: unknown[]) => fetchMock(...args),
}));

function fakeContracts(chainId: ChainId) {
  getContractMock.mockImplementation(({ address }: { address: string }) => {
    if (address === ensContract[chainId]?.address) {
      return {
        read: {
          resolver: registryResolverMock,
          owner: vi.fn(async () => OWNER),
        },
      };
    }
    if (address === dclRegistrar[chainId]?.address) {
      return { read: { getTokenId: vi.fn(async () => 42n) } };
    }
    throw new Error(`Unexpected contract address: ${address}`);
  });
}

describe('when fetching DCL names', () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
    store.dispatch(actions.setChainId(ChainId.ETHEREUM_MAINNET));
    fakeContracts(ChainId.ETHEREUM_MAINNET);
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ data: [] }) });
    fetchNamesMock.mockResolvedValue(['Name.dcl.eth']);
    registryResolverMock.mockResolvedValue(CURRENT_RESOLVER);
    vi.mocked(resolveContent).mockResolvedValue({
      content: CONTENT_HASH,
      resolver: CURRENT_RESOLVER,
    });
    getEnsAddressMock.mockResolvedValue(RECORD_ADDRESS);
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should resolve the address record through the ENS Universal Resolver', async () => {
    const [name] = await store.dispatch(fetchDCLNames({ address: OWNER })).unwrap();

    expect(getEnsAddressMock).toHaveBeenCalledWith({
      name: 'name.dcl.eth',
      universalResolverAddress: UNIVERSAL_RESOLVER,
      strict: true,
    });
    expect(name.ensAddressRecord).toBe(RECORD_ADDRESS);
  });

  it("should not read the address record from a hardcoded resolver, only the name's current one", async () => {
    await store.dispatch(fetchDCLNames({ address: OWNER })).unwrap();

    const resolverAddresses = getContractMock.mock.calls
      .map(([{ address }]) => address)
      .filter(
        address =>
          address !== ensContract[ChainId.ETHEREUM_MAINNET]?.address &&
          address !== dclRegistrar[ChainId.ETHEREUM_MAINNET]?.address,
      );
    expect(resolverAddresses).toEqual([]);
  });

  it('should use the Universal Resolver of the configured chain', async () => {
    store.dispatch(actions.setChainId(ChainId.ETHEREUM_SEPOLIA));
    fakeContracts(ChainId.ETHEREUM_SEPOLIA);

    await store.dispatch(fetchDCLNames({ address: OWNER })).unwrap();

    expect(getEnsAddressMock).toHaveBeenCalledWith(
      expect.objectContaining({
        universalResolverAddress: sepolia.contracts.ensUniversalResolver.address,
      }),
    );
    expect(mainnet.contracts.ensUniversalResolver.address).toBe(UNIVERSAL_RESOLVER);
  });

  it('should store an empty record when the name has no address record', async () => {
    getEnsAddressMock.mockResolvedValue(null);

    const [name] = await store.dispatch(fetchDCLNames({ address: OWNER })).unwrap();

    expect(name.ensAddressRecord).toBe('');
  });

  it('should store an empty record when the address record is the zero address', async () => {
    getEnsAddressMock.mockResolvedValue(zeroAddress);

    const [name] = await store.dispatch(fetchDCLNames({ address: OWNER })).unwrap();

    expect(name.ensAddressRecord).toBe('');
  });

  it('should keep the name with an empty record when resolution fails', async () => {
    getEnsAddressMock.mockRejectedValue(new Error('RPC error'));

    const names = await store.dispatch(fetchDCLNames({ address: OWNER })).unwrap();

    expect(names).toHaveLength(1);
    expect(names[0].ensAddressRecord).toBe('');
    expect(names[0].content).toBe(CONTENT_HASH);
    expect(console.log).toHaveBeenCalledWith(
      'Failed to fetch ens address record',
      expect.any(Error),
    );
  });

  describe('when the name has no resolver of its own or on an ancestor', () => {
    beforeEach(() => {
      const abi = parseAbi(['error ResolverError(bytes errorData)']);
      getEnsAddressMock.mockRejectedValue(
        new BaseError('Contract call failed', {
          cause: new ContractFunctionRevertedError({
            abi,
            data: encodeErrorResult({
              abi,
              errorName: 'ResolverError',
              args: [
                encodeErrorResult({
                  abi: parseAbi(['error UnreachableName(bytes name)']),
                  errorName: 'UnreachableName',
                  args: ['0x046e616d650364636c0365746800'],
                }),
              ],
            }),
            functionName: 'resolveWithGateways',
          }),
        }),
      );
    });

    it('should store an empty address record without logging a failure', async () => {
      const [name] = await store.dispatch(fetchDCLNames({ address: OWNER })).unwrap();

      expect(name.ensAddressRecord).toBe('');
      expect(console.log).not.toHaveBeenCalled();
    });
  });

  it('should read the content hash through the Universal Resolver', async () => {
    const [name] = await store.dispatch(fetchDCLNames({ address: OWNER })).unwrap();

    expect(resolveContent).toHaveBeenCalledWith(
      expect.anything(),
      'name.dcl.eth',
      UNIVERSAL_RESOLVER,
    );
    expect(name.resolver).toBe(CURRENT_RESOLVER);
    expect(name.content).toBe(CONTENT_HASH);
  });

  describe('when a parent resolves a name without a direct resolver', () => {
    beforeEach(() => {
      registryResolverMock.mockResolvedValue(zeroAddress);
    });

    it('should retain the content and effective resolver', async () => {
      await expect(store.dispatch(fetchDCLNames({ address: OWNER })).unwrap()).resolves.toEqual([
        expect.objectContaining({ content: CONTENT_HASH, resolver: CURRENT_RESOLVER }),
      ]);
    });
  });

  describe('when the name has no content profile', () => {
    beforeEach(() => {
      vi.mocked(resolveContent).mockResolvedValue({ content: '' });
    });

    it('should retain the direct registry resolver without logging a failure', async () => {
      await expect(store.dispatch(fetchDCLNames({ address: OWNER })).unwrap()).resolves.toEqual([
        expect.objectContaining({ content: '', resolver: CURRENT_RESOLVER }),
      ]);
      expect(console.log).not.toHaveBeenCalled();
    });
  });

  describe('when content resolution fails', () => {
    beforeEach(() => {
      vi.mocked(resolveContent).mockRejectedValue(new Error('Gateway unavailable'));
    });

    it('should retain the name and its address record', async () => {
      await expect(store.dispatch(fetchDCLNames({ address: OWNER })).unwrap()).resolves.toEqual([
        expect.objectContaining({ content: '', ensAddressRecord: RECORD_ADDRESS }),
      ]);
    });
  });

  describe.each(['address', 'content'])('and the %s lookup never settles', record => {
    beforeEach(() => {
      vi.useFakeTimers();
      if (record === 'address')
        getEnsAddressMock.mockImplementationOnce(() => new Promise(() => {}));
      else vi.mocked(resolveContent).mockImplementationOnce(() => new Promise(() => {}));
    });
    afterEach(() => {
      vi.useRealTimers();
    });
    it('should finish the list after the deadline and retain the other record', async () => {
      const names = store.dispatch(fetchDCLNames({ address: OWNER })).unwrap();
      await vi.advanceTimersByTimeAsync(ENS_RECORD_TIMEOUT_MS);
      await expect(names).resolves.toEqual([
        expect.objectContaining({
          ensAddressRecord: record === 'address' ? '' : RECORD_ADDRESS,
          content: record === 'content' ? '' : CONTENT_HASH,
        }),
      ]);
      expect(console.log).toHaveBeenCalledWith(
        record === 'address'
          ? 'Failed to fetch ens address record'
          : 'Failed to resolve ens content',
        expect.any(Error),
      );
    });
  });

  it('should reject for a chain without ENS contracts', async () => {
    store.dispatch(actions.setChainId(ChainId.MATIC_MAINNET));

    await expect(store.dispatch(fetchDCLNames({ address: OWNER })).unwrap()).rejects.toThrow(
      `ENS contract for chainId ${ChainId.MATIC_MAINNET} not found.`,
    );
    expect(getEnsAddressMock).not.toHaveBeenCalled();
  });
});

describe('fetchENSList', () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
    store.dispatch(actions.setChainId(ChainId.ETHEREUM_MAINNET));
    fakeContracts(ChainId.ETHEREUM_MAINNET);
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ data: [] }) });
    registryResolverMock.mockResolvedValue(CURRENT_RESOLVER);
    vi.mocked(resolveContent).mockResolvedValue({
      content: CONTENT_HASH,
      resolver: CURRENT_RESOLVER,
    });
    getEnsAddressMock.mockResolvedValue(RECORD_ADDRESS);
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('when the wallet owns a NAME and is also on its World deployment allow-list', () => {
    beforeEach(() => {
      fetchNamesMock.mockResolvedValue(['fixtureone.dcl.eth']);
      fetchNamesOwnersMock.mockResolvedValue({ fixtureone: OWNER, fixturetwo: '0xother' });
      fetchContributableDomainsMock.mockResolvedValue([
        {
          name: 'fixtureone.dcl.eth',
          user_permissions: [USER_PERMISSIONS.DEPLOYMENT],
          owner: OWNER,
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
      await store.dispatch(fetchENSList({ address: OWNER })).unwrap();

      expect(store.getState().ens.data['fixtureone.dcl.eth']).toMatchObject({
        ensOwnerAddress: OWNER,
        resolver: CURRENT_RESOLVER,
        content: CONTENT_HASH,
      });
    });

    it('should list the owned NAME once', async () => {
      const list = await store.dispatch(fetchENSList({ address: OWNER })).unwrap();

      expect(list.filter(({ subdomain }) => subdomain === 'fixtureone.dcl.eth')).toHaveLength(1);
    });

    it('should keep the NAMEs it can only contribute to', async () => {
      await store.dispatch(fetchENSList({ address: OWNER })).unwrap();

      expect(store.getState().ens.data['fixturetwo.dcl.eth']).toMatchObject({
        nftOwnerAddress: '0xother',
        userPermissions: [USER_PERMISSIONS.DEPLOYMENT],
        size: '20',
      });
    });
  });
});

describe('when the Manage list loads its first page of unpublished Worlds', () => {
  beforeEach(async () => {
    const store = createTestStore();
    store.dispatch(actions.setChainId(ChainId.ETHEREUM_MAINNET));
    fakeContracts(ChainId.ETHEREUM_MAINNET);
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ data: [] }) });
    fetchNamesMock.mockResolvedValue([]);
    fetchContributableDomainsMock.mockResolvedValue([]);
    store.dispatch(managementActions.setPublishFilter(FilterBy.UNPUBLISHED));

    await store.dispatch(fetchManagedProjectsFiltered()).unwrap();
  });

  it('should ask for the contributable names once', () => {
    expect(fetchContributableDomainsMock).toHaveBeenCalledTimes(1);
  });
});

describe('ens reducer', () => {
  describe('when the account changes while the NAME requests are in flight', () => {
    const args = { address: '0xprevious' };
    const name = { subdomain: 'previous.dcl.eth' } as ENS;
    const state = [
      slice.actions.setChainId(ChainId.ETHEREUM_SEPOLIA),
      fetchENSList.pending('loaded', args),
      fetchENSList.fulfilled([name], 'loaded', args),
      fetchENSList.pending('late', args),
      accountChanged(),
      fetchENSList.fulfilled([name], 'late', args),
    ].reduce(slice.reducer, slice.getInitialState());

    it('should drop the previous account NAMEs and their late answers', () => {
      expect(state.data).toEqual({});
      expect(state.status).toBe('idle');
    });

    it('should keep the network, which belongs to no account', () => {
      expect(state.chainId).toBe(ChainId.ETHEREUM_SEPOLIA);
    });
  });

  describe('when two NAME requests overlap and the newer one fails after the older one lands', () => {
    const args = { address: OWNER };
    const state = [
      fetchENSList.pending('older', args),
      fetchENSList.pending('newer', args),
      fetchENSList.fulfilled([{ subdomain: 'older.dcl.eth' } as ENS], 'older', args),
      fetchENSList.rejected(new Error('boom'), 'newer', args),
    ].reduce(slice.reducer, slice.getInitialState());

    it('should keep the older NAMEs as loaded ones', () => {
      expect(Object.keys(state.data)).toEqual(['older.dcl.eth']);
      expect(state.status).toBe('succeeded');
    });
  });

  describe('when an older NAME request answers after a newer one', () => {
    const args = { address: OWNER };
    const state = [
      fetchENSList.pending('older', args),
      fetchENSList.pending('newer', args),
      fetchENSList.fulfilled([{ subdomain: 'newer.dcl.eth' } as ENS], 'newer', args),
      fetchENSList.fulfilled([{ subdomain: 'older.dcl.eth' } as ENS], 'older', args),
    ].reduce(slice.reducer, slice.getInitialState());

    it('should keep the newer NAMEs', () => {
      expect(Object.keys(state.data)).toEqual(['newer.dcl.eth']);
    });
  });
});
