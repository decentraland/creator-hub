import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { encodeAbiParameters, zeroAddress } from 'viem';
import { mainnet, sepolia } from 'viem/chains';
import type * as Viem from 'viem';
import { ChainId } from '@dcl/schemas/dist/dapps/chain-id';
import type * as SharedFetch from '/shared/fetch';
import type * as EnsLib from '/@/lib/ens';
import { createTestStore } from '../../../../tests/utils/testStore';
import { ens as ensContract, dclRegistrar } from './contracts';
import { actions, fetchDCLNames } from './slice';

const OWNER = '0x1111111111111111111111111111111111111111';
const CURRENT_RESOLVER = '0x2222222222222222222222222222222222222222';
const RECORD_ADDRESS = '0x3333333333333333333333333333333333333333';
const CONTENT_HASH = '0xe301017012201234';
const UNIVERSAL_RESOLVER = '0xeeeeeeee14d718c2b47d9923deab1335e144eeee';

const getEnsAddressMock = vi.fn();
const registryResolverMock = vi.fn();
const readContractMock = vi.fn();
const getContractMock = vi.fn();
const fetchNamesMock = vi.fn();
const fetchMock = vi.fn();

vi.mock('viem', async importOriginal => ({
  ...(await importOriginal<typeof Viem>()),
  createPublicClient: () => ({ getEnsAddress: getEnsAddressMock, readContract: readContractMock }),
  getContract: (params: { address: string }) => getContractMock(params),
}));

vi.mock('/@/lib/ens', async importOriginal => ({
  ...(await importOriginal<typeof EnsLib>()),
  DCLNames: class {
    fetchNames = fetchNamesMock;
  },
}));

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

describe('fetchDCLNames', () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
    store.dispatch(actions.setChainId(ChainId.ETHEREUM_MAINNET));
    fakeContracts(ChainId.ETHEREUM_MAINNET);
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ data: [] }) });
    fetchNamesMock.mockResolvedValue(['Name.dcl.eth']);
    registryResolverMock.mockResolvedValue(CURRENT_RESOLVER);
    readContractMock.mockResolvedValue([
      encodeAbiParameters([{ type: 'bytes' }], [CONTENT_HASH]),
      CURRENT_RESOLVER,
    ]);
    getEnsAddressMock.mockResolvedValue(RECORD_ADDRESS);
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('resolves the address record through the ENS Universal Resolver', async () => {
    const [name] = await store.dispatch(fetchDCLNames({ address: OWNER })).unwrap();

    expect(getEnsAddressMock).toHaveBeenCalledWith({
      name: 'name.dcl.eth',
      universalResolverAddress: UNIVERSAL_RESOLVER,
    });
    expect(name.ensAddressRecord).toBe(RECORD_ADDRESS);
  });

  it("does not read the address record from a hardcoded resolver, only the name's current one", async () => {
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

  it('uses the Universal Resolver of the configured chain', async () => {
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

  it('stores an empty record when the name has no address record', async () => {
    getEnsAddressMock.mockResolvedValue(null);

    const [name] = await store.dispatch(fetchDCLNames({ address: OWNER })).unwrap();

    expect(name.ensAddressRecord).toBe('');
  });

  it('stores an empty record when the address record is the zero address', async () => {
    getEnsAddressMock.mockResolvedValue(zeroAddress);

    const [name] = await store.dispatch(fetchDCLNames({ address: OWNER })).unwrap();

    expect(name.ensAddressRecord).toBe('');
  });

  it('keeps the name with an empty record when resolution fails', async () => {
    getEnsAddressMock.mockRejectedValue(new Error('RPC error'));

    const names = await store.dispatch(fetchDCLNames({ address: OWNER })).unwrap();

    expect(names).toHaveLength(1);
    expect(names[0].ensAddressRecord).toBe('');
    expect(names[0].content).toBe(CONTENT_HASH);
  });

  it('reads the content hash through the Universal Resolver', async () => {
    const [name] = await store.dispatch(fetchDCLNames({ address: OWNER })).unwrap();

    expect(readContractMock).toHaveBeenCalledWith(
      expect.objectContaining({ address: UNIVERSAL_RESOLVER, functionName: 'resolve' }),
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

  describe('when content resolution fails', () => {
    beforeEach(() => {
      readContractMock.mockRejectedValue(new Error('Gateway unavailable'));
    });

    it('should retain the name and its address record', async () => {
      await expect(store.dispatch(fetchDCLNames({ address: OWNER })).unwrap()).resolves.toEqual([
        expect.objectContaining({ content: '', ensAddressRecord: RECORD_ADDRESS }),
      ]);
    });
  });

  it('rejects for a chain without ENS contracts', async () => {
    store.dispatch(actions.setChainId(ChainId.MATIC_MAINNET));

    await expect(store.dispatch(fetchDCLNames({ address: OWNER })).unwrap()).rejects.toThrow(
      `ENS contract for chainId ${ChainId.MATIC_MAINNET} not found.`,
    );
    expect(getEnsAddressMock).not.toHaveBeenCalled();
  });
});
