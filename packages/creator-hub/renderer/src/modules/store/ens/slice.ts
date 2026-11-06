import { createSlice } from '@reduxjs/toolkit';
import { createPublicClient, getContract, http, zeroAddress, type Address } from 'viem';
import { namehash } from 'viem/ens';
import pLimit from 'p-limit';
import { captureException } from '@sentry/electron/renderer';
import { ChainId } from '@dcl/schemas/dist/dapps/chain-id';
import type { Async } from '/shared/types/async';
import { config } from '/@/config';
import { fetch } from '/shared/fetch';
import { DCLNames, ENS as ENSApi } from '/@/lib/ens';
import { Worlds } from '/@/lib/worlds';
import { createAsyncThunk } from '/@/modules/store/thunk';
import { accountChanged, isSignedInAccount } from '/@/modules/store/account';
import { settleRequest, settleRequestAndOlder } from '/@/modules/store/requests';
import { ENS as ensAbi, DCLRegistrar as dclRegistrarAbi } from './abis';
import { ens as ensContract, ensUniversalResolver, dclRegistrar } from './contracts';
import { getEnsProvider, getStreamOnlyWorldNames, isValidENSName } from './utils';
import { isMissingENSRecordError, resolveContent } from './resolveContent';
import { withENSRecordClient } from './ccipRead';
import { USER_PERMISSIONS, type ContributableDomain, type ENS } from './types';

const DEFAULT_CHAIN_ID: ChainId = Number(config.get('CHAIN_ID')) || ChainId.ETHEREUM_MAINNET;
const REQUESTS_BATCH_SIZE = 25;
const limit = pLimit(REQUESTS_BATCH_SIZE);

// actions
const fetchContributableDomains = async (address: string) => {
  try {
    return await new Worlds().fetchContributableDomains(address);
  } catch (error) {
    captureException(error, {
      tags: {
        source: 'ens',
        event: 'fetch-contributable-names',
      },
    });
    return [];
  }
};

const isDeployable = (domain: ContributableDomain) =>
  domain.user_permissions.includes(USER_PERMISSIONS.DEPLOYMENT);

export const fetchContributeENSNames = async (address: string) =>
  (await fetchContributableDomains(address)).filter(isDeployable);

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
    const universalResolverAddress = ensUniversalResolver[chainId];

    if (!ensData || !dclRegistrarData || !universalResolverAddress) {
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
        let resolver = resolverAddress.toLowerCase();

        // Resolve through the name's current resolver (found by the ENS Universal Resolver,
        // with CCIP-Read for offchain names), not a hardcoded one it may no longer use.
        // Both lookups run at once so a stalled gateway costs one deadline per name, not two.
        const [addressRecord, contentRecord] = await Promise.allSettled([
          withENSRecordClient(config.get('RPC_URL'), client =>
            client.getEnsAddress({ name: subdomain, universalResolverAddress, strict: true }),
          ),
          // An ancestor can resolve the name even without a direct registry resolver.
          withENSRecordClient(config.get('RPC_URL'), client =>
            resolveContent(client, subdomain, universalResolverAddress),
          ),
        ]);

        if (addressRecord.status === 'fulfilled') {
          const resolvedAddress = addressRecord.value;
          ensAddressRecord =
            resolvedAddress && resolvedAddress !== zeroAddress ? resolvedAddress : '';
        } else if (!isMissingENSRecordError(addressRecord.reason)) {
          // Strict mode surfaces gateway/resolver outages; a name with no resolver is not one.
          console.log('Failed to fetch ens address record', addressRecord.reason);
        }

        if (contentRecord.status === 'fulfilled') {
          content = contentRecord.value.content;
          resolver = contentRecord.value.resolver ?? resolver;
        } else {
          console.log('Failed to resolve ens content', contentRecord.reason);
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
  { condition: isSignedInAccount },
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
  { condition: isSignedInAccount },
);

export type ContributableNames = { names: ENS[]; streamOnly: string[] };

export const fetchContributableNames = createAsyncThunk(
  'ens/fetchContributableNames',
  async ({ address }: { address: string }): Promise<ContributableNames> => {
    const dclNamesApi = new DCLNames();
    const ensApi = new ENSApi();
    const bannedNames = await fetchBannedNames();
    const bannedNamesSet = new Set(bannedNames.map(x => x.toLowerCase()));

    const isAllowed = (name: string) =>
      name.split('.').every(nameSegment => !bannedNamesSet.has(nameSegment));
    const domains = await fetchContributableDomains(address);
    const names = domains.filter(isDeployable).filter(({ name }) => isAllowed(name));
    const streamOnly = getStreamOnlyWorldNames(domains).filter(isAllowed);

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

    return { names: await Promise.all(promisesOfContributableENSNames), streamOnly };
  },
  { condition: isSignedInAccount },
);

export const fetchENSList = createAsyncThunk(
  'ens/fetchENSList',
  async (
    { address, contributable }: { address: string; contributable?: ContributableNames },
    thunkApi,
  ) => {
    const dclNames = await thunkApi.dispatch(fetchDCLNames({ address })).unwrap();
    const ensNames = await thunkApi.dispatch(fetchENS({ address })).unwrap();
    const { names: contributableNames } =
      contributable ?? (await thunkApi.dispatch(fetchContributableNames({ address })).unwrap());

    const owned = [...dclNames, ...ensNames];
    const ownedSubdomains = new Set(owned.map(({ subdomain }) => subdomain));

    return [
      ...owned,
      ...contributableNames.filter(({ subdomain }) => !ownedSubdomains.has(subdomain)),
    ];
  },
  { condition: isSignedInAccount },
);

// state
export type ENSState = {
  chainId: ChainId;
  data: Record<string, ENS>;
  /** NAME list requests still in flight for the current account, oldest first. */
  requestIds: string[];
};

export const initialState: Async<ENSState> = {
  chainId: DEFAULT_CHAIN_ID,
  data: {},
  status: 'idle',
  error: null,
  requestIds: [],
};

// slice
export const slice = createSlice({
  name: 'ens',
  initialState,
  reducers: {
    setChainId: (state, action: { payload: ChainId }) => {
      state.chainId = action.payload;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(accountChanged, state => ({ ...initialState, chainId: state.chainId }))
      .addCase(fetchENSList.pending, (state, action) => {
        state.status = 'loading';
        state.requestIds.push(action.meta.requestId);
      })
      .addCase(fetchENSList.fulfilled, (state, action) => {
        if (!settleRequestAndOlder(state.requestIds, action.meta.requestId)) return;
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
      })
      .addCase(fetchENSList.rejected, (state, action) => {
        if (!settleRequest(state.requestIds, action.meta.requestId)) return;
        state.status = state.requestIds.length
          ? 'loading'
          : Object.keys(state.data).length
            ? 'succeeded'
            : 'failed';
        state.error = action.error.message ?? 'Failed to load NAMEs';
        captureException(action.error, {
          tags: { source: 'ens', event: 'fetch-ens-list' },
        });
      });
  },
});

// exports
export const actions = { ...slice.actions, fetchENSList };
export const reducer = slice.reducer;
export const selectors = { ...slice.selectors };
