import { createSlice } from '@reduxjs/toolkit';
import { createPublicClient, getContract, http, zeroAddress, type Address } from 'viem';
import { namehash } from 'viem/ens';
import pLimit from 'p-limit';
import { ChainId } from '@dcl/schemas/dist/dapps/chain-id';
import type { Async } from '/shared/types/async';
import { config } from '/@/config';
import { fetch } from '/shared/fetch';
import { DCLNames, ENS as ENSApi } from '/@/lib/ens';
import { Worlds } from '/@/lib/worlds';
import { createAsyncThunk } from '/@/modules/store/thunk';
import {
  ENS as ensAbi,
  ENSResolver as ensResolverAbi,
  DCLRegistrar as dclRegistrarAbi,
} from './abis';
import { ens as ensContract, ensResolver, dclRegistrar } from './contracts';
import { getEnsProvider, isValidENSName } from './utils';
import { USER_PERMISSIONS, type ENS, type ENSError } from './types';

const DEFAULT_CHAIN_ID: ChainId = Number(config.get('CHAIN_ID')) || ChainId.ETHEREUM_MAINNET;
const REQUESTS_BATCH_SIZE = 25;
const limit = pLimit(REQUESTS_BATCH_SIZE);

// actions
export const fetchContributeENSNames = async (address: string) => {
  try {
    const WorldAPI = new Worlds();
    const domains = await WorldAPI.fetchContributableDomains(address);
    return domains.filter(domain => domain.user_permissions.includes(USER_PERMISSIONS.DEPLOYMENT));
  } catch (_) {
    return [];
  }
};

export const fetchBannedNames = async () => {
  const dclListsUrl = config.get('DCL_LISTS_URL');
  const response: Response = await fetch(`${dclListsUrl}/banned-names`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error(response.status.toString());
  }

  const { data: bannedNames }: { data: string[] } = await response.json();

  return bannedNames;
};

export const fetchDCLNames = createAsyncThunk(
  'ens/fetchNames',
  async ({ address }: { address: string }, { getState }) => {
    if (!address) return [];

    const chainId = getState().ens.chainId;
    const provider = createPublicClient({
      transport: http(config.get('RPC_URL')),
    });

    const ensData = ensContract[chainId];
    const dclRegistrarData = dclRegistrar[chainId];
    const resolverData = ensResolver[chainId];

    if (!ensData || !dclRegistrarData || !resolverData) {
      throw new Error(`ENS contract for chainId ${chainId} not found.`);
    }

    const ensImplementation = getContract({
      address: ensData.address as Address,
      abi: ensAbi,
      client: provider,
    });

    const dclRegistrarImplementation = getContract({
      address: dclRegistrarData.address as Address,
      abi: dclRegistrarAbi,
      client: provider,
    });

    const resolverImplementation = getContract({
      address: resolverData.address as Address,
      abi: ensResolverAbi,
      client: provider,
    });

    const dclNamesApi = new DCLNames();
    const bannedNames = await fetchBannedNames();

    let names = await dclNamesApi.fetchNames(address);
    names = names.filter(domain => !bannedNames.includes(domain)).filter(isValidENSName);

    const promisesOfDCLENS: Promise<ENS>[] = names.map(data => {
      return limit(async () => {
        const subdomain = data.toLowerCase();
        const name = subdomain.split('.')[0];
        const landId: string | undefined = undefined;
        let content = '';
        let ensAddressRecord = '';
        const nodehash = namehash(subdomain);
        const [resolverAddress, ownerRaw, tokenIdRaw] = await Promise.all([
          ensImplementation.read.resolver([nodehash]),
          ensImplementation.read.owner([nodehash]),
          dclRegistrarImplementation.read.getTokenId([name]),
        ]);

        const owner = ownerRaw.toLowerCase();
        const tokenId = tokenIdRaw.toString().toLowerCase();
        const resolver = resolverAddress.toLowerCase();

        try {
          const resolvedAddress = (await resolverImplementation.read.addr([nodehash])) as Address;
          ensAddressRecord = resolvedAddress !== zeroAddress ? resolvedAddress : '';
        } catch (_e) {
          console.log('Failed to fetch ens address record');
        }

        if (resolver !== zeroAddress) {
          try {
            const dynamicResolver = getContract({
              address: resolverAddress,
              abi: ensResolverAbi,
              client: provider,
            });
            content = await dynamicResolver.read.contenthash([nodehash]);
          } catch (error) {
            console.log('Failed to load ens resolver', error);
          }
        }

        return {
          name,
          subdomain,
          provider: getEnsProvider(subdomain),
          tokenId,
          ensOwnerAddress: owner,
          nftOwnerAddress: address,
          resolver,
          content,
          ensAddressRecord,
          landId,
        };
      });
    });

    return Promise.all(promisesOfDCLENS);
  },
);

export const fetchENS = createAsyncThunk(
  'ens/fetchENS',
  async ({ address }: { address: string }) => {
    const ensApi = new ENSApi();
    const bannedNames = await fetchBannedNames();
    const bannedNamesSet = new Set(bannedNames.map(x => x.toLowerCase()));

    let names = await ensApi.fetchNames(address);
    names = names
      .filter(name => name.split('.').every(nameSegment => !bannedNamesSet.has(nameSegment)))
      .filter(isValidENSName);

    const promisesOfENS: Promise<ENS>[] = names.map(data => {
      return limit(async () => {
        const subdomain = data.toLowerCase();
        const name = subdomain.split('.')[0];

        return {
          name,
          subdomain,
          provider: getEnsProvider(subdomain),
          nftOwnerAddress: address,
          content: '',
          ensOwnerAddress: '',
          resolver: '',
          tokenId: '',
        };
      });
    });
    return Promise.all(promisesOfENS);
  },
);

export const fetchContributableNames = createAsyncThunk(
  'ens/fetchContributableNames',
  async ({ address }: { address: string }) => {
    const dclNamesApi = new DCLNames();
    const ensApi = new ENSApi();
    const bannedNames = await fetchBannedNames();
    const bannedNamesSet = new Set(bannedNames.map(x => x.toLowerCase()));

    let names = await fetchContributeENSNames(address);
    names = names.filter(({ name }) =>
      name.split('.').every(nameSegment => !bannedNamesSet.has(nameSegment)),
    );

    const [ownerByNameDomain, ownerByEnsDomain]: [Record<string, string>, Record<string, string>] =
      await Promise.all([
        dclNamesApi.fetchNamesOwners(
          names
            .filter(item => item.name.endsWith('dcl.eth'))
            .map(item => item.name.replace('.dcl.eth', '')),
        ),
        ensApi.fetchNamesOwners(
          names.filter(item => !item.name.endsWith('dcl.eth')).map(item => item.name),
        ),
      ]);

    const promisesOfContributableENSNames: Promise<ENS>[] = names.map(data => {
      return limit(async () => {
        const subdomain = data.name.toLowerCase();
        const name = subdomain.split('.')[0];

        return {
          name,
          subdomain,
          provider: getEnsProvider(subdomain),
          nftOwnerAddress: subdomain.includes('dcl.eth')
            ? ownerByNameDomain[name]
            : ownerByEnsDomain[subdomain],
          content: '',
          ensOwnerAddress: '',
          resolver: '',
          tokenId: '',
          userPermissions: data.user_permissions,
          size: data.size,
        };
      });
    });

    return Promise.all(promisesOfContributableENSNames);
  },
);

export const fetchENSList = createAsyncThunk(
  'ens/fetchENSList',
  async (payload: { address: string }, thunkApi) => {
    const dclNames = await thunkApi.dispatch(fetchDCLNames(payload)).unwrap();
    const ensNames = await thunkApi.dispatch(fetchENS(payload)).unwrap();
    const contributableNames = await thunkApi.dispatch(fetchContributableNames(payload)).unwrap();

    return [...dclNames, ...ensNames, ...contributableNames];
  },
);

// state
export type ENSState = {
  chainId: ChainId;
  data: Record<string, ENS>;
  error: ENSError | null;
};

export const initialState: Async<ENSState> = {
  chainId: DEFAULT_CHAIN_ID,
  data: {},
  status: 'idle',
  error: null,
};

// slice
export const slice = createSlice({
  name: 'ens',
  initialState,
  reducers: {
    clearState: () => initialState,
    setChainId: (state, action: { payload: ChainId }) => {
      state.chainId = action.payload;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(fetchENSList.pending, state => {
        state.status = 'loading';
      })
      .addCase(fetchENSList.fulfilled, (state, action) => {
        state.data = {
          ...state.data,
          ...action.payload.reduce(
            (acc, ens) => {
              acc[ens.subdomain] = ens;
              return acc;
            },
            { ...state.data },
          ),
        };
        state.status = 'succeeded';
      });
  },
});

// exports
export const actions = { ...slice.actions, fetchENSList };
export const reducer = slice.reducer;
export const selectors = { ...slice.selectors };
