import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { ethers, Contract } from 'ethers';
import { namehash } from '@ethersproject/hash';
import pLimit from 'p-limit';
import type { ChainId } from '@dcl/schemas/dist/dapps/chain-id';
import type { Async } from '/shared/types/async';
import { config } from '/@/config';
import { fetch } from '/shared/fetch';
import { DCLNames, ENS as ENSApi } from '/@/lib/ens';
import { Worlds } from '/@/lib/worlds';
import { ens as ensContract, ensResolver, dclRegistrar } from './contracts';
import { getEnsProvider, isValidENSName } from './utils';
import { USER_PERMISSIONS, type ENS, type ENSError } from './types';

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
  async ({ address, chainId }: { address: string; chainId: ChainId }) => {
    if (!address) return [];

    const provider = new ethers.JsonRpcProvider(config.get('RPC_URL'));

    // TODO: Implement logic to fetch lands from the builder-server
    // const lands: Land[]
    // const landHashes: { id: string; hash: string }[]

    if (!ensContract[chainId]) {
      throw new Error(`ENS contract for chainId ${chainId} not found.`);
    }

    const ensImplementation = new Contract(
      ensContract[chainId].address,
      new ethers.Interface(ensContract[chainId].abi),
      provider,
    );

    const dclRegistrarImplementation = new Contract(
      dclRegistrar[chainId].address,
      dclRegistrar[chainId].abi,
      provider,
    );

    const dclNamesApi = new DCLNames();
    const bannedNames = await fetchBannedNames();

    let names = await dclNamesApi.fetchNames(address);
    names = names.filter(domain => !bannedNames.includes(domain)).filter(isValidENSName);

    const promisesOfDCLENS: Promise<ENS>[] = names.map(data => {
      return limit(async () => {
        const subdomain = data.toLowerCase();
        const name = subdomain.split('.')[0];
        // TODO: Implement logic to fetch lands from the builder-server
        const landId: string | undefined = undefined;
        let content = '';
        let ensAddressRecord = '';
        const nodehash = namehash(subdomain);
        const [resolverAddress, owner, tokenId]: [string, string, string] = await Promise.all([
          ensImplementation.resolver(nodehash),
          ensImplementation.owner(nodehash).then(owner => owner.toLowerCase()),
          dclRegistrarImplementation.getTokenId(name).then(name => name.toString()),
        ]);

        const resolver = resolverAddress.toString();

        try {
          const resolverImplementation = new Contract(
            ensResolver[chainId].address,
            new ethers.Interface(ensResolver[chainId].abi),
            provider,
          );
          const resolvedAddress = await resolverImplementation['addr(bytes32)'](nodehash);
          ensAddressRecord = resolvedAddress !== ethers.ZeroAddress ? resolvedAddress : '';
        } catch (e) {
          console.log('Failed to fetch ens address record');
        }

        if (resolver !== ethers.ZeroAddress) {
          try {
            const resolverImplementation = new Contract(
              resolverAddress,
              new ethers.Interface(ensResolver[chainId].abi),
              provider,
            );
            content = await resolverImplementation.contenthash(nodehash);

            // TODO: Implement logic to fetch lands from the builder-server
            // const land = landHashes.find(lh => lh.hash === content);
            // if (land) {
            //   landId = land.id;
            // }
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
  async (payload: { address: string; chainId: ChainId }, thunkApi) => {
    const dclNames = await thunkApi.dispatch(fetchDCLNames(payload)).unwrap();
    const ensNames = await thunkApi.dispatch(fetchENS(payload)).unwrap();
    const contributableNames = await thunkApi.dispatch(fetchContributableNames(payload)).unwrap();

    return [...dclNames, ...ensNames, ...contributableNames];
  },
);

// state
export type ENSState = {
  data: Record<string, ENS>;
  error: ENSError | null;
};

export const initialState: Async<ENSState> = {
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
