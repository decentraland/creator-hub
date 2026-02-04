import { config } from '/@/config';
import { fetch } from '/shared/fetch';

const BATCH_SIZE = 1000;

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

  public async fetchNames(address: string) {
    const response: Response = await fetch(this.subgraph, {
      method: 'POST',
      headers: {
        accept: 'application/graphql-response+json, application/json, multipart/mixed',
        'accept-language': 'en-US,en;q=0.9,es;q=0.8',
        'cache-control': ' no-cache',
        'content-type': ' application/json',
        origin: ' https://api.studio.thegraph.com',
        pragma: ' no-cache',
        priority: ' u=1, i',
        'sec-ch-ua': ' "Not(A:Brand";v="8", "Chromium";v="144", "Google Chrome";v="144"',
        'sec-ch-ua-mobile': ' ?0',
        'sec-ch-ua-platform': ' "macOS"',
        'sec-fetch-dest': ' empty',
        'sec-fetch-mode': ' cors',
        'sec-fetch-site': ' same-origin',
        'user-agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) creator-hub/0.0.0-dev Chrome/138.0.7204.235 Electron/37.3.1 Safari/537.36',
      },
      body: JSON.stringify({
        query: `query getENS {
          domains(
            where: {or: [
              { wrappedOwner: "${address.toLowerCase()}" },
              { registrant: "${address.toLowerCase()}" }
            ]}
          ) {
            name
          }
        }`,
        operationName: 'getENS',
        extensions: {},
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
  }

  public async fetchNamesOwners(domains: string[]): Promise<Record<string, string>> {
    if (!domains) {
      return {};
    }

    const response: Response = await fetch(this.subgraph, {
      method: 'POST',
      headers: {
        accept: 'application/graphql-response+json, application/json, multipart/mixed',
        'accept-language': 'en-US,en;q=0.9,es;q=0.8',
        'cache-control': ' no-cache',
        'content-type': ' application/json',
        origin: ' https://api.studio.thegraph.com',
        pragma: ' no-cache',
        priority: ' u=1, i',
        'sec-ch-ua': ' "Not(A:Brand";v="8", "Chromium";v="144", "Google Chrome";v="144"',
        'sec-ch-ua-mobile': ' ?0',
        'sec-ch-ua-platform': ' "macOS"',
        'sec-fetch-dest': ' empty',
        'sec-fetch-mode': ' cors',
        'sec-fetch-site': ' same-origin',
        'user-agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) creator-hub/0.0.0-dev Chrome/138.0.7204.235 Electron/37.3.1 Safari/537.36',
      },
      body: JSON.stringify({
        query: `query getOwners($domains: [String]) {
          domains(where: { name_in: $domains }) {
            name
            wrappedOwner {
              id
            }
          }
        }`,
        operationName: 'getOwners',
        extensions: {},
        variables: { domains },
      }),
    });

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

  public async fetchNames(address: string) {
    let results: string[] = [];
    let offset = 0;
    let nextPage = true;

    while (nextPage) {
      const response: Response = await fetch(this.subgraph, {
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
  }

  public async fetchNamesOwners(domains: string[]) {
    if (!domains) {
      return {};
    }

    const results: Record<string, string> = {};
    let offset = 0;
    let nextPage = true;

    while (nextPage) {
      const response: Response = await fetch(this.subgraph, {
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
      });

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
