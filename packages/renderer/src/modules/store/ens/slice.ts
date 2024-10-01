import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { ethers, Contract } from 'ethers';
import { namehash } from '@ethersproject/hash';
import pLimit from 'p-limit';
import type { ChainId } from '@dcl/schemas/dist/dapps/chain-id';
import { getContract, ContractName } from 'decentraland-transactions';
import { Worlds } from '/@/lib/worlds';
import type { Async } from '/@/modules/async';
import { ens as ensContract, ensResolver } from './contracts';
import { getEnsProvider, isValidENSName, isDev } from './utils';
import type { DCLDomainsQueryResult, DomainsQueryResult, ENS, ENSError } from './types';

const REQUESTS_BATCH_SIZE = 25;
const BATCH_SIZE = 1000;
const limit = pLimit(REQUESTS_BATCH_SIZE);

// actions
export const fetchDCLENSNames = async (address: string, chainId: ChainId) => {
  let dclEnsSubgraph = 'https://subgraph.decentraland.org/marketplace';
  if (isDev(chainId)) {
    dclEnsSubgraph = 'https://subgraph.decentraland.org/marketplace-sepolia';
  }

  let results: string[] = [];
  let offset = 0;
  let nextPage = true;

  while (nextPage) {
    const response: Response = await fetch(dclEnsSubgraph, {
      method: 'POST',
      body: JSON.stringify({
        query: `{
          nfts(
            first: ${BATCH_SIZE},
            skip: ${offset},
            where: {
              owner_: { id: "${address.toLowerCase()}" },
              category: ens
            }
          ) {
            ens {
              subdomain
            }
          }
        }`,
      }),
    });

    if (!response.ok) {
      throw new Error(response.status.toString());
    }

    const queryResult: DCLDomainsQueryResult = await response.json();

    if ('errors' in queryResult) {
      throw new Error(JSON.stringify(queryResult.errors));
    }
    const domains: string[] = queryResult.data.nfts.map(
      nft => `${nft.ens.subdomain.toString()}.dcl.eth`,
    );
    results = results.concat(domains);

    if (domains.length === BATCH_SIZE) {
      offset += BATCH_SIZE;
    } else {
      nextPage = false;
    }
  }

  return results;
};

export const fetchENSNames = async (address: string, chainId: ChainId) => {
  let ensSubgraph = 'https://subgraph.decentraland.org/ens';
  if (isDev(chainId)) {
    ensSubgraph = 'https://subgraph.decentraland.org/ens-sepolia';
  }

  const response: Response = await fetch(ensSubgraph, {
    method: 'POST',
    body: JSON.stringify({
      query: `{
        domains(
          where: {or: [
            { wrappedOwner: "${address.toLowerCase()}" },
            { registrant: "${address.toLowerCase()}" }
          ]}
        ) {
          name
        }
      }`,
    }),
  });

  if (!response.ok) {
    throw new Error(response.status.toString());
  }

  const queryResult: DomainsQueryResult = await response.json();

  if ('errors' in queryResult) {
    throw new Error(JSON.stringify(queryResult.errors));
  }

  return queryResult.data.domains.map(domain => domain.name);
};

export const fetchBannedNames = async (chainId: ChainId) => {
  let dclListsUrl = 'https://dcl-lists.decentraland.org';
  if (isDev(chainId)) {
    dclListsUrl = 'https://dcl-lists.decentraland.zone';
  }

  const response: Response = await fetch(`${dclListsUrl}/banned-names`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error(response.status.toString());
  }

  const { data: bannedNames }: { data: string[] } = await response.json();

  return bannedNames;
};

export const fetchENSList = createAsyncThunk(
  'ens/fetchENSList',
  async (payload: { address: string; chainId: ChainId }) => {
    const { address, chainId } = payload;

    if (!address) return [];

    const provider = new ethers.JsonRpcProvider(
      `https://rpc.decentraland.org/${isDev(chainId) ? 'sepolia' : 'mainnet'}`,
    );
    const WorldAPI = new Worlds(isDev(chainId));

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

    const dclRegistrar = getContract(ContractName.DCLRegistrar, chainId);
    const dclRegistrarImplementation = new Contract(
      dclRegistrar.address,
      dclRegistrar.abi,
      provider,
    );

    const [dclENSNames, ENSNames] = await Promise.all([
      fetchDCLENSNames(address, chainId),
      fetchENSNames(address, chainId),
    ]);
    let domains: string[] = [...dclENSNames, ...ENSNames];
    const bannedDomains: string[] = await fetchBannedNames(chainId);
    domains = domains.filter(domain => !bannedDomains.includes(domain)).filter(isValidENSName);

    const promisesOfENS: Promise<ENS>[] = domains.map(data => {
      return limit(async () => {
        const subdomain = data.toLocaleLowerCase();
        const name = subdomain.split('.')[0];
        // TODO: Implement logic to fetch lands from the builder-server
        const landId: string | undefined = undefined;
        let content = '';
        let worldStatus = null;
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

        const world = await WorldAPI.fetchWorld(subdomain);
        if (world && world.length > 0) {
          const [{ id: entityId }] = world;
          worldStatus = {
            scene: {
              entityId,
            },
          };
        }

        const ens: ENS = {
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
          worldStatus,
        };

        return ens;
      });
    });

    const ensList: ENS[] = await Promise.all(promisesOfENS);
    return ensList;
  },
);

// state
export type ENSState = {
  data: Record<string, ENS>;
  externalNames: Record<string, ENS>;
  contributableNames: Record<string, ENS>;
  error: ENSError | null;
  contributableNamesError: ENSError | null;
};

export const initialState: Async<ENSState> = {
  data: {},
  externalNames: {},
  contributableNames: {},
  status: 'idle',
  error: null,
  contributableNamesError: null,
};

// slice
export const slice = createSlice({
  name: 'ens',
  initialState,
  reducers: {},
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
      });
  },
});

// exports
export const actions = { ...slice.actions, fetchENSList };
export const reducer = slice.reducer;
export const selectors = { ...slice.selectors };
