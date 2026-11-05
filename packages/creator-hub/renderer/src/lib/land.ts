import fromUnixTime from 'date-fns/fromUnixTime';
import { config } from '/@/config';
import { fetch } from '/shared/fetch';
import { chunk, retry } from '/shared/utils';
import type { WorldDeployment } from './worlds';

// TheGraph has a limit of a maximum of 1000 results per entity per query
const MAX_RESULTS = 1000;

/** A large estate can hold hundreds of parcels; the content server takes them in batches. */
const MAX_POINTERS_PER_REQUEST = 100;

/**
 * Resolving a batch of pointers answers with every scene's full entity record, so
 * it runs to hundreds of kilobytes and outlasts the default timeout on a cold cache.
 */
const ENTITIES_TIMEOUT_MS = 30_000;

const SEPARATOR = ',';

export type Coords = [number, number];

export const coordsToId = (x: string | number, y: string | number) => `${x}${SEPARATOR}${y}`;

/**
 * Strict counterpart to `idToCoords`, for input that may not be a coordinate at
 * all — a scene's `base` from a deployment, or an id from a URL.
 *
 * `idToCoords` maps anything unparseable to an empty string, which reads back as
 * `0,0` once coerced to a number. That silently points at a real parcel someone
 * else owns, so anything not exactly `<int>,<int>` is rejected here instead.
 */
export const parseCoords = (id: string): { x: number; y: number } | null => {
  const match = /^(-?\d+),(-?\d+)$/.exec(id.trim());
  return match ? { x: Number(match[1]), y: Number(match[2]) } : null;
};
export const idToCoords = (id: string): [string | number, string | number] => {
  const [x = '', y = ''] = id
    ?.split(SEPARATOR)
    .map(num => parseInt(num, 10))
    .map(num => (isNaN(num) ? '' : num)) || ['', ''];
  return [x, y];
};

/**
 * Who the Catalyst lets deploy, read off the subgraph. It mirrors the access check
 * every deployment goes through (`checkLAND` in decentraland/checker-contract,
 * `validations/access/subgraph/scenes.ts` in decentraland/content-validator): the
 * token's owner, its approved address, its update operator, or someone the owner
 * approved on that same registry. A rented-out token's owner is the Rentals
 * contract and its update operator is whoever the tenant named, so the lessor
 * holds no right to it until it is claimed back.
 */
type DeployAccess = {
  address: string;
  /** Owners whose latest LAND registry authorization to `address` is approved. */
  landGrantors: Set<string>;
  /** Owners whose latest Estate registry authorization to `address` is approved. */
  estateGrantors: Set<string>;
};

const isAddress = (candidate: string | null | undefined, address: string) =>
  !!candidate && candidate.toLowerCase() === address;

const canDeployTo = (
  token: Pick<ParcelFields, 'owner' | 'operator' | 'updateOperator'>,
  access: DeployAccess,
  grantors: Set<string>,
) =>
  isAddress(token.owner.address, access.address) ||
  isAddress(token.operator, access.address) ||
  isAddress(token.updateOperator, access.address) ||
  grantors.has(token.owner.address.toLowerCase());

const fromParcel = (parcel: ParcelFields, role: RoleType, access: DeployAccess) => {
  const id = coordsToId(parcel.x, parcel.y);

  const result: Land = {
    id,
    tokenId: parcel.tokenId,
    name: (parcel.data && parcel.data.name) || 'Parcel',
    type: LandType.PARCEL,
    roles: [role],
    role,
    description: (parcel.data && parcel.data.description) || null,
    x: parseInt(parcel.x, 10),
    y: parseInt(parcel.y, 10),
    owner: parcel.owner.address,
    operators: [],
    deployable: canDeployTo(parcel, access, access.landGrantors),
  };

  if (parcel.updateOperator) {
    result.operators.push(parcel.updateOperator);
  }

  return result;
};

const fromEstate = (estate: EstateFields, role: RoleType, access: DeployAccess) => {
  const id = estate.id;

  const result: Land = {
    id,
    tokenId: id,
    name: (estate.data && estate.data.name) || `Estate ${id}`,
    type: LandType.ESTATE,
    roles: [role],
    role,
    description: (estate.data && estate.data.description) || null,
    size: estate.size,
    parcels: estate.parcels.map(parcel => ({
      x: parseInt(parcel.x, 10),
      y: parseInt(parcel.y, 10),
      id: coordsToId(parcel.x, parcel.y),
    })),
    owner: estate.owner.address,
    operators: [],
    deployable: canDeployTo(estate, access, access.estateGrantors),
  };

  if (estate.updateOperator) {
    result.operators.push(estate.updateOperator);
  }

  return result;
};

function isMax(result: LandQueryResult) {
  // true if any result length matches the MAX_RESULTS constant
  return Object.values(result).some(value => value.length >= MAX_RESULTS);
}

function isZero(addr: string) {
  return /^0x(0)+$/.test(addr);
}

export const parcelFields = () => `
  fragment parcelFields on Parcel {
    x
    y
    tokenId
    owner {
      address
    }
    operator
    updateOperator
    data {
      name
      description
    }
  }
`;

export const estateFields = () => `
  fragment estateFields on Estate {
    id
    owner {
      address
    }
    operator
    updateOperator
    size
    parcels(first: 1000) {
      x
      y
      tokenId
    }
    data {
      name
      description
    }
  }
`;

/**
 * The authorization kinds that let an owner's counterparty deploy to the owner's
 * tokens on that registry: `UpdateManager` (`setUpdateManager`) and the two names
 * the subgraph gives `setApprovalForAll`.
 */
const GRANTING_AUTHORIZATIONS = ['UpdateManager', 'ApprovalForAll', 'Operator'] as const;

const getLandQuery = (skip = 0) => `
  query Land($address: Bytes, $tenantTokenIds: [String!], $lessorTokenIds: [String!]) {
    tenantParcels: parcels(first: ${MAX_RESULTS}, skip: ${skip}, where: { tokenId_in: $tenantTokenIds }) {
      ...parcelFields
    }
    tenantEstates: estates(first: ${MAX_RESULTS}, skip: ${skip}, where: { id_in: $tenantTokenIds }) {
      ...estateFields
    }
    lessorParcels: parcels(first: ${MAX_RESULTS}, skip: ${skip}, where: { tokenId_in: $lessorTokenIds }) {
      ...parcelFields
    }
    lessorEstates: estates(first: ${MAX_RESULTS}, skip: ${skip}, where: { id_in: $lessorTokenIds }) {
      ...estateFields
    }
    ownerParcels: parcels(first: ${MAX_RESULTS}, skip: ${skip}, where: { estate: null, owner: $address }) {
      ...parcelFields
    }
    ownerEstates: estates(first: ${MAX_RESULTS}, skip: ${skip}, where: { owner: $address }) {
      ...estateFields
    }
    updateOperatorParcels: parcels(first: ${MAX_RESULTS}, skip: ${skip}, where: { updateOperator: $address }) {
      ...parcelFields
    }
    updateOperatorEstates: estates(first: ${MAX_RESULTS}, skip: ${skip}, where: { updateOperator: $address }) {
      ...estateFields
    }
    approvedParcels: parcels(first: ${MAX_RESULTS}, skip: ${skip}, where: { operator: $address }) {
      ...parcelFields
    }
    approvedEstates: estates(first: ${MAX_RESULTS}, skip: ${skip}, where: { operator: $address }) {
      ...estateFields
    }
    ownerAuthorizations: authorizations(first: ${MAX_RESULTS}, skip: ${skip}, orderBy: timestamp, orderDirection: desc, where: { owner: $address, type: "UpdateManager" }) {
      type
      operator
      isApproved
      tokenAddress
      timestamp
    }
    operatorAuthorizations: authorizations(first: ${MAX_RESULTS}, skip: ${skip}, orderBy: timestamp, orderDirection: desc, where: { operator: $address, type_in: ${JSON.stringify(GRANTING_AUTHORIZATIONS)} }) {
      type
      owner {
        address
        parcels(first: ${MAX_RESULTS}, skip: ${skip}, where: { estate: null }) {
          ...parcelFields
        }
        estates(first: ${MAX_RESULTS}) {
          ...estateFields
        }
      }
      isApproved
      tokenAddress
      timestamp
    }
  }
  ${parcelFields()}
  ${estateFields()}
`;

export enum LandType {
  PARCEL = 'parcel',
  ESTATE = 'estate',
}

export enum RoleType {
  OWNER = 1,
  LESSOR = 2,
  TENANT = 3,
  OPERATOR = 4,
}

export type Land = {
  id: string;
  tokenId: string;
  type: LandType;
  roles: RoleType[];
  role: RoleType;
  x?: number;
  y?: number;
  parcels?: { x: number; y: number; id: string }[];
  size?: number;
  name: string;
  description: string | null;
  owner: string;
  operators: string[];
  /**
   * Whether the Catalyst accepts a deployment to this land from the wallet it was
   * fetched for. A lessor still sees the land it rented out, but cannot deploy to it.
   */
  deployable: boolean;
};

export type ParcelFields = {
  x: string;
  y: string;
  tokenId: string;
  owner: {
    address: string;
  };
  /** The address approved for this one token (`approve`), if any. */
  operator: string | null;
  updateOperator: string | null;
  data: {
    name: string | null;
    description: string | null;
  } | null;
};

export type EstateFields = {
  id: string;
  owner: {
    address: string;
  };
  /** The address approved for this one token (`approve`), if any. */
  operator: string | null;
  updateOperator: string | null;
  size: number;
  parcels: Pick<ParcelFields, 'x' | 'y' | 'tokenId'>[];
  data: {
    name: string | null;
    description: string | null;
  } | null;
};

export type Authorization = {
  address: string;
  type: LandType;
};

export type RentalFields = {
  id: string;
  contractAddress: string;
  tokenId: string;
  lessor: string;
  tenant: string;
  operator: string;
  startedAt: string;
  endsAt: string;
};

export type Rental = {
  id: string;
  type: LandType;
  tokenId: string;
  lessor: string;
  tenant: string;
  operator: string;
  startedAt: Date;
  endsAt: Date;
};

export type LandQueryResult = {
  tenantParcels: ParcelFields[];
  tenantEstates: EstateFields[];
  lessorParcels: ParcelFields[];
  lessorEstates: EstateFields[];
  ownerParcels: ParcelFields[];
  ownerEstates: EstateFields[];
  updateOperatorParcels: ParcelFields[];
  updateOperatorEstates: EstateFields[];
  approvedParcels: ParcelFields[];
  approvedEstates: EstateFields[];
  ownerAuthorizations: AuthorizationEvent<{ operator: string }>[];
  operatorAuthorizations: AuthorizationEvent<{
    owner: { address: string; parcels: ParcelFields[]; estates: EstateFields[] };
  }>[];
};

type AuthorizationEvent<T> = T & {
  type: string;
  isApproved: boolean;
  tokenAddress: string;
  /** Block time in microseconds plus the log index, so later events always sort higher. */
  timestamp: string;
};

/**
 * The subgraph keeps every authorization event, not the current state: a revoke is
 * a newer `isApproved: false` beside the original grant. Only the latest event per
 * counterparty, registry and kind is in force.
 */
function latestAuthorizations<T extends AuthorizationEvent<object>>(
  events: T[],
  counterparty: (event: T) => string,
): T[] {
  const latest = new Map<string, T>();
  for (const event of events) {
    const key = `${counterparty(event).toLowerCase()}-${event.tokenAddress.toLowerCase()}-${event.type}`;
    const seen = latest.get(key);
    if (!seen || BigInt(event.timestamp) > BigInt(seen.timestamp)) latest.set(key, event);
  }
  return [...latest.values()];
}

export type LandDeployment = Omit<WorldDeployment, 'metadata'> & {
  metadata: Omit<WorldDeployment['metadata'], 'worldConfiguration'>;
};

export enum Color {
  NEON_BLUE = '#00D3FF',
  SUMMER_RED = '#FF2D55',
  VOID = '#16141A',
  LUISXVI_VIOLET = '#A524B3',
  IDONTFEELTHATWELL = '#F3F2F5',
  SHADOWS = '#242129',
  NIGHT_TIME = '#691FA9',
  BLUISH_STEEL = '#676370',
  INNOCENCE = '#FFFFFF',
  CANDY_PURPLE = '#C640CD',
  SUNISH = '#FFBC5B',
  MILLENIAL_ORANGE = '#FC9965',
  OJ_NOT_SIMPSON = '#FF7439',
  DARK = '#18141A',
}

export const colorByRole: Record<RoleType, string> = {
  [RoleType.OWNER]: Color.SUMMER_RED,
  [RoleType.LESSOR]: Color.MILLENIAL_ORANGE,
  [RoleType.OPERATOR]: Color.LUISXVI_VIOLET,
  [RoleType.TENANT]: Color.SUMMER_RED,
};

export class Lands {
  private subgraph = config.get('LAND_MANAGER_SUBGRAPH');
  private LAND_REGISTRY_ADDRESS = config.get('LAND_REGISTRY_ADDRESS');
  private ESTATE_REGISTRY_ADDRESS = config.get('ESTATE_REGISTRY_ADDRESS');
  private PEER_URL = config.get('PEER_URL');

  public getContentSrcUrl(hash: string) {
    return `${this.PEER_URL}/content/contents/${hash}`;
  }

  fetchLand = async (
    _address: string,
    tenantTokenIds: string[] = [],
    lessorTokenIds: string[] = [],
    skip = 0,
  ): Promise<[Land[], Authorization[]]> => {
    const address = _address.toLowerCase();

    const response: Response = await fetch(this.subgraph, {
      method: 'POST',
      body: JSON.stringify({
        query: getLandQuery(skip),
        variables: {
          address,
          tenantTokenIds,
          lessorTokenIds,
        },
      }),
      headers: {
        Accept: '*/*',
        'Content-Type': 'application/json',
      },
    });

    const { data }: { data: LandQueryResult } = await response.json();

    const lands: Land[] = [];
    const landUpdateManagers = new Set<string>();
    const estateUpdateManagers = new Set<string>();

    const grants = latestAuthorizations(
      data.operatorAuthorizations,
      event => event.owner.address,
    ).filter(grant => grant.isApproved);
    const grantorsOn = (registry: string) =>
      new Set(
        grants
          .filter(grant => grant.tokenAddress.toLowerCase() === registry)
          .map(grant => grant.owner.address.toLowerCase()),
      );
    const access: DeployAccess = {
      address,
      landGrantors: grantorsOn(this.LAND_REGISTRY_ADDRESS),
      estateGrantors: grantorsOn(this.ESTATE_REGISTRY_ADDRESS),
    };

    // parcels and estates that I own
    for (const parcel of data.ownerParcels) {
      lands.push(fromParcel(parcel, RoleType.OWNER, access));
    }
    for (const estate of data.ownerEstates) {
      lands.push(fromEstate(estate, RoleType.OWNER, access));
    }

    // parcels and estates that I operate, or that were approved to me one by one
    for (const parcel of [...data.updateOperatorParcels, ...data.approvedParcels]) {
      lands.push(fromParcel(parcel, RoleType.OPERATOR, access));
    }
    for (const estate of [...data.updateOperatorEstates, ...data.approvedEstates]) {
      lands.push(fromEstate(estate, RoleType.OPERATOR, access));
    }

    // parcels and estates that I've rented
    for (const parcel of data.tenantParcels) {
      lands.push(fromParcel(parcel, RoleType.TENANT, access));
    }
    for (const estate of data.tenantEstates) {
      lands.push(fromEstate(estate, RoleType.TENANT, access));
    }

    // parcels and estates that I've put for rent
    for (const parcel of data.lessorParcels) {
      lands.push(fromParcel(parcel, RoleType.LESSOR, access));
    }
    for (const estate of data.lessorEstates) {
      lands.push(fromEstate(estate, RoleType.LESSOR, access));
    }

    // addresses I gave UpdateManager permission are operators of all my lands
    for (const { operator, isApproved, tokenAddress } of latestAuthorizations(
      data.ownerAuthorizations,
      event => event.operator,
    )) {
      if (!isApproved) continue;
      if (tokenAddress === this.LAND_REGISTRY_ADDRESS) landUpdateManagers.add(operator);
      if (tokenAddress === this.ESTATE_REGISTRY_ADDRESS) estateUpdateManagers.add(operator);
    }

    // I'm operator of the lands whose owner approved me on that land's own registry
    for (const { owner, tokenAddress } of grants) {
      const registry = tokenAddress.toLowerCase();
      const parcels = registry === this.LAND_REGISTRY_ADDRESS ? owner.parcels : [];
      const estates = registry === this.ESTATE_REGISTRY_ADDRESS ? owner.estates : [];
      for (const parcel of parcels) {
        const land = fromParcel(parcel, RoleType.OPERATOR, access);
        land.operators.push(address);
        // skip if already owned or operated
        if (!lands.some(_land => _land.id === land.id)) {
          lands.push(land);
        }
      }
      for (const estate of estates) {
        if (estate.parcels.length > 0) {
          const land = fromEstate(estate, RoleType.OPERATOR, access);
          land.operators.push(address);
          // skip if already owned or operated
          if (!lands.some(_land => _land.id === land.id)) {
            lands.push(land);
          }
        }
      }
    }

    // add operators for all my lands
    const authorizations: Authorization[] = [];
    for (const operator of landUpdateManagers.values()) {
      authorizations.push({ address: operator, type: LandType.PARCEL });
      const parcels = lands.filter(
        land => land.type === LandType.PARCEL && land.role === RoleType.OWNER,
      );
      for (const parcel of parcels) {
        parcel.operators.push(operator);
      }
    }
    for (const operator of estateUpdateManagers.values()) {
      authorizations.push({ address: operator, type: LandType.ESTATE });
      const estates = lands.filter(
        land => land.type === LandType.ESTATE && land.role === RoleType.OWNER,
      );
      for (const estate of estates) {
        estate.operators.push(operator);
      }
    }

    const landsMap: Record<string, Land> = {};

    for (const land of lands) {
      // Remove empty estates
      if (land.type === LandType.ESTATE && land.parcels!.length <= 0) {
        continue;
      }

      // Remove duplicated and zero address operators
      land.operators = Array.from(new Set(land.operators)).filter(address => !isZero(address));

      const savedLand = landsMap[land.id];

      if (savedLand) {
        // Update existing land roles
        savedLand.roles = [...savedLand.roles, land.role].sort();
        savedLand.role = savedLand.roles[0];
        savedLand.deployable ||= land.deployable;
      } else {
        // Add to the total map
        landsMap[land.id] = land;
      }
    }

    // check if we need to fetch more results
    if (isMax(data)) {
      // merge results recursively
      const [moreLands, moreAuthorizations] = await this.fetchLand(
        address,
        tenantTokenIds,
        lessorTokenIds,
        skip + MAX_RESULTS,
      );
      const landResults = [...Object.values(landsMap), ...moreLands];
      const authorizationResults = [...authorizations, ...moreAuthorizations];
      return [landResults, authorizationResults];
    } else {
      return [Object.values(landsMap), authorizations];
    }
  };

  /**
   * The scenes deployed on any of the given parcels, one entry per scene.
   *
   * `/content/entities/active` resolves many pointers at once and answers each
   * scene once, however many parcels it covers — so a 100-parcel estate holding
   * one scene costs one request and yields one entity, not a hundred.
   */
  public async fetchLandPublishedScenes(coords: Coords[]): Promise<LandDeployment[]> {
    const groups = await Promise.all(
      chunk(coords, MAX_POINTERS_PER_REQUEST).map(group =>
        retry(async () => {
          const result = await fetch(
            `${this.PEER_URL}/content/entities/active`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ pointers: group.map(([x, y]) => coordsToId(x, y)) }),
            },
            ENTITIES_TIMEOUT_MS,
          );

          if (!result.ok) {
            throw new Error(`Failed to resolve ${group.length} parcels: ${result.status}`);
          }
          return (await result.json()) as LandDeployment[];
        }),
      ),
    );

    const byEntityId = new Map(groups.flat().map(scene => [scene.id, scene]));
    return [...byEntityId.values()];
  }
}

export const rentalFields = () => `
  fragment rentalFields on Rental {
    id
    contractAddress
    tokenId
    lessor
    tenant
    operator
    startedAt
    endsAt
  }
`;

const getRentalsQuery = () => `query Rentals($address: Bytes) {
    tenantRentals: rentals(where: { tenant: $address, isActive: true }) {
      ...rentalFields
    }
    lessorRentals: rentals(where: { lessor: $address, isActive: true }) {
      ...rentalFields
    }
  }
  ${rentalFields()}
`;

export class Rentals {
  private subgraph = config.get('RENTALS_SUBGRAPH');
  private LAND_REGISTRY_ADDRESS = config.get('LAND_REGISTRY_ADDRESS');
  private ESTATE_REGISTRY_ADDRESS = config.get('ESTATE_REGISTRY_ADDRESS');

  fetchRentalTokenIds = async (
    address: string,
  ): Promise<{ lessorRentals: Rental[]; tenantRentals: Rental[] }> => {
    const response: Response = await fetch(this.subgraph, {
      method: 'POST',
      body: JSON.stringify({
        query: getRentalsQuery(),
        variables: {
          address: address.toLowerCase(),
        },
      }),
      headers: {
        Accept: '*/*',
        'Content-Type': 'application/json',
      },
    });

    const {
      data,
    }: {
      data: {
        lessorRentals: RentalFields[];
        tenantRentals: RentalFields[];
      };
    } = await response.json();

    // `isActive` stays true after a rental ends, until the lessor claims the land
    // back, so a tenant's rental is only current while it has not run out.
    const now = Date.now();
    return {
      lessorRentals: data.lessorRentals.map(this.fromRentalFields),
      tenantRentals: data.tenantRentals
        .map(this.fromRentalFields)
        .filter(rental => rental.endsAt.getTime() > now),
    };
  };

  getLandType = (contractAddress: string): LandType => {
    switch (contractAddress.toLowerCase()) {
      case this.LAND_REGISTRY_ADDRESS:
        return LandType.PARCEL;
      case this.ESTATE_REGISTRY_ADDRESS:
        return LandType.ESTATE;
      default:
        throw new Error(`Could not derive land type from contract address "${contractAddress}"`);
    }
  };

  fromRentalFields = (fields: RentalFields): Rental => {
    return {
      id: fields.id,
      type: this.getLandType(fields.contractAddress),
      tokenId: fields.tokenId,
      lessor: fields.lessor,
      tenant: fields.tenant,
      operator: fields.operator,
      startedAt: fromUnixTime(+fields.startedAt),
      endsAt: fromUnixTime(+fields.endsAt),
    };
  };
}
