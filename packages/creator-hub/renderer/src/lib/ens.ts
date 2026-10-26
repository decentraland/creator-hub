import type { Hex } from 'viem';
import { config } from '/@/config';
import { fetch } from '/shared/fetch';
import { LandType, type Land } from './land';

const BATCH_SIZE = 1000;
const REDIRECTION_COORDS_PER_REQUEST = 100;

export type Domain = { name: string };
export type DomainsQueryResult = { data: { domains: Domain[] } } | { errors: any };

export type OwnerByENSTuple = {
  name: string;
  wrappedOwner: {
    id: string;
  };
};
export type OwnerByENSQueryResult =
  | {
      data: {
        domains: OwnerByENSTuple[];
      };
    }
  | { errors: any };

export class ENS {
  private subgraph = config.get('ENS_SUBGRAPH');
  private subgraphTimeout = 10000;

  public async fetchNames(address: string) {
    const response: Response = await fetch(
      this.subgraph,
      {
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
      },
      this.subgraphTimeout,
    );

    if (!response.ok) {
      throw new Error(response.status.toString());
    }

    const queryResult: DomainsQueryResult = await response.json();

    if ('errors' in queryResult) {
      throw new Error(JSON.stringify(queryResult.errors));
    }

    return queryResult.data.domains.map(domain => domain.name);
  }

  public async fetchNamesOwners(domains: string[]): Promise<Record<string, string>> {
    if (!domains) {
      return {};
    }

    const response: Response = await fetch(
      this.subgraph,
      {
        method: 'POST',
        body: JSON.stringify({
          query: `query getOwners($domains: [String]) {
          domains(where: { name_in: $domains }) {
            name
            wrappedOwner {
              id
            }
          }
        }`,
          variables: { domains },
        }),
      },
      this.subgraphTimeout,
    );

    if (!response.ok) {
      throw new Error(response.status.toString());
    }

    const queryResult: OwnerByENSQueryResult = await response.json();

    if ('errors' in queryResult) {
      throw new Error(JSON.stringify(queryResult.errors));
    }

    const results: Record<string, string> = {};
    queryResult.data.domains.forEach(({ wrappedOwner, name }) => {
      if (wrappedOwner && wrappedOwner.id) {
        results[name] = wrappedOwner.id;
      }
    });
    return results;
  }
}

export type DCLDomainsQueryResult =
  | { data: { nfts: { ens: { subdomain: string } }[] } }
  | { errors: any };

export type DCLOwnerByNameTuple = {
  owner: {
    address: string;
  };
  ens: {
    subdomain: string;
  };
};
export type DCLOwnerByNameQueryResult = {
  data: {
    nfts: DCLOwnerByNameTuple[];
  };
};

export class DCLNames {
  private subgraph = config.get('MARKETPLACE_SUBGRAPH');
  private subgraphTimeout = 10000;

  public async fetchNames(address: string) {
    let results: string[] = [];
    let offset = 0;
    let nextPage = true;

    while (nextPage) {
      const response: Response = await fetch(
        this.subgraph,
        {
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
        },
        this.subgraphTimeout,
      );

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
  }

  public async fetchNamesOwners(domains: string[]) {
    if (!domains) {
      return {};
    }

    const results: Record<string, string> = {};
    let offset = 0;
    let nextPage = true;

    while (nextPage) {
      const response: Response = await fetch(
        this.subgraph,
        {
          method: 'POST',
          body: JSON.stringify({
            query: `query getOwners($domains: [String!], $offset: Int) {
            nfts(first: ${BATCH_SIZE}, skip: $offset, where: { name_in: $domains, category: ens }) {
              owner {
                address
              }
              ens {
                subdomain
              }
            }
          }`,
            variables: { domains, offset },
          }),
        },
        this.subgraphTimeout,
      );

      if (!response.ok) {
        throw new Error(response.status.toString());
      }

      const queryResult: DCLOwnerByNameQueryResult = await response.json();

      if ('errors' in queryResult) {
        throw new Error(JSON.stringify(queryResult.errors));
      }
      queryResult.data.nfts.forEach(({ ens, owner }) => {
        results[ens.subdomain] = owner.address;
      });

      if (queryResult.data.nfts.length === BATCH_SIZE) {
        offset += BATCH_SIZE;
      } else {
        nextPage = false;
      }
    }

    return results;
  }
}

export type LandCoords = { x: number; y: number };

type BuilderResponse<T> = { ok: boolean; data: T; error?: string };

const landCoords = (land: Land): LandCoords[] =>
  land.type === LandType.ESTATE ? (land.parcels ?? []) : [{ x: land.x!, y: land.y! }];

export class LandRedirections {
  private url = config.get('BUILDER_SERVER_URL');
  private timeout = 10000;

  private async read<T>(response: Response): Promise<T> {
    const body: BuilderResponse<T> = await response.json();
    if (!response.ok || !body.ok) {
      throw new Error(body.error || response.status.toString());
    }
    return body.data;
  }

  /** Pins the redirection page of a parcel on IPFS and returns its ENS content hash. */
  public async create({ x, y }: LandCoords): Promise<Hex> {
    const response = await fetch(
      `${this.url}/lands/${x},${y}/redirection`,
      { method: 'POST' },
      this.timeout,
    );
    const { contentHash } = await this.read<{ contentHash: string }>(response);
    return `0x${contentHash}`;
  }

  /** Maps the lowercased content hash of every parcel's redirection page to its land id. */
  public async fetchHashes(lands: Land[]): Promise<Record<string, string>> {
    const landIdByCoords = new Map(
      lands.flatMap(land => landCoords(land).map(({ x, y }) => [`${x},${y}`, land.id])),
    );
    const coords = [...landIdByCoords.keys()];
    const hashes: Record<string, string> = {};

    for (let i = 0; i < coords.length; i += REDIRECTION_COORDS_PER_REQUEST) {
      const query = coords
        .slice(i, i + REDIRECTION_COORDS_PER_REQUEST)
        .map(c => `coords=${c}`)
        .join('&');
      const response = await fetch(
        `${this.url}/lands/redirectionHashes?${query}`,
        {},
        this.timeout,
      );
      const batch = await this.read<(LandCoords & { contentHash: string })[]>(response);
      for (const { x, y, contentHash } of batch) {
        hashes[`0x${contentHash.toLowerCase()}`] = landIdByCoords.get(`${x},${y}`)!;
      }
    }

    return hashes;
  }
}
