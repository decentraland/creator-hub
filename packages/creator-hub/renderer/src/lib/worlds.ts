import { captureException } from '@sentry/electron/renderer';
import type { AuthIdentity, AuthChain } from '@dcl/crypto';
import { localStorageGetIdentity } from '@dcl/single-sign-on-client';
import type { Entity, IPFSv2 } from '@dcl/schemas';
import fetch from 'decentraland-crypto-fetch';

import { config } from '/@/config';
import type { ContributableDomain } from '/@/modules/store/ens/types';
import { formatQueryParams, fromCamelToSnake, fromSnakeToCamel } from '../modules/api';

export type WorldDeployment = {
  id: string;
  timestamp: number;
  version: string;
  type: string;
  pointers: string[];
  content: Content[];
  metadata: Metadata;
};

export type Content = {
  file: string;
  hash: string;
};

export type Metadata = {
  allowedMediaHostnames?: string[];
  owner: string;
  main: string;
  contact: Contact;
  display: Display;
  tags: string[];
  scene: Scene;
  sdkVersion: string;
  ecs7: boolean;
  runtimeVersion: string;
  source: Source;
  worldConfiguration: WorldConfiguration;
  spawnPoints?: SpawnPoint[];
  requiredPermissions?: string[];
  featureToggles?: FeatureToggles;
  skyboxConfig?: SkyboxConfig;
  rating?: string;
};

export type Contact = {
  name: string;
  email: string;
};

export type Display = {
  title: string;
  description: string;
  favicon: string;
  navmapThumbnail: string;
};

export type Scene = {
  base: string;
  parcels: string[];
};

export type SpawnPoint = {
  name: string;
  default?: boolean;
  position: {
    x: number[];
    y: number[];
    z: number[];
  };
  cameraTarget?: {
    x: number;
    y: number;
    z: number;
  };
};

export type FeatureToggles = {
  voiceChat?: string;
  portableExperiences?: string;
  nearbyVoiceChat?: string;
};

export type SkyboxConfig = {
  fixedTime?: number;
  transitionMode?: number;
};

export type Source = {
  version?: number;
  origin: string;
  point?: Point;
  projectId: string;
  layout?: Layout;
};

export type Layout = {
  rows: number;
  cols: number;
};

export type Point = {
  x: number;
  y: number;
};

export type WorldConfiguration = {
  name: string;
};

export type WorldData = {
  name: string;
  owner: string;
  deployedScenes: number;
  title: string | null;
  description: string | null;
  contentRating: string | null;
  spawnCoordinates: string | null;
  skyboxTime: number | null;
  singlePlayer: boolean | null;
  showInPlaces: boolean | null;
  categories: string[] | null;
  thumbnailHash: string | null;
  lastDeployedAt: string | null;
  blockedSince: string | null;
  worldShape: {
    x1: number;
    x2: number;
    y1: number;
    y2: number;
  } | null;
};

export type WorldDataResponse = {
  worlds: WorldData[];
  total: number;
};

export type WorldScene = {
  worldName: string;
  deployer: string;
  deploymentAuthChain: AuthChain;
  entity: Entity;
  entityId: IPFSv2;
  parcels: string[];
  size: string;
  thumbnailUrl?: string; // This is a computed field, not part of the API response
  createdAt: string; // ISO 8601 string
};

export type WorldScenes = {
  scenes: WorldScene[];
  total: number;
};

export type WorldSettings = {
  title?: string;
  description?: string;
  thumbnail?: string;
  thumbnailHash?: string;
  contentRating?: SceneAgeRating;
  categories?: SceneCategory[] | null;
  spawnCoordinates?: string;
  skyboxTime?: number | null;
  singlePlayer?: boolean;
  showInPlaces?: boolean;
};

export enum SceneAgeRating {
  Adult = 'A',
}

export enum SceneCategory {
  ART = 'art',
  GAME = 'game',
  CASINO = 'casino',
  SOCIAL = 'social',
  MUSIC = 'music',
  FASHION = 'fashion',
  CRYPTO = 'crypto',
  EDUCATION = 'education',
  SHOP = 'shop',
  BUSINESS = 'business',
  SPORTS = 'sports',
}

export enum WorldRoleType {
  OWNER = 'owner',
  COLLABORATOR = 'collaborator',
}

export type WorldInfo = {
  healthy: boolean;
  configurations: {
    networkId: number;
    globalScenesUrn: string[];
    scenesUrn: string[];
    cityLoaderContentServer: string;
  };
  content: {
    healthy: boolean;
    publicUrl: string;
  };
  lambdas: {
    healthy: boolean;
    publicUrl: string;
  };
};

export type WorldsWalletStats = {
  wallet: string;
  dclNames: {
    name: string;
    size: string;
  }[];
  ensNames: {
    name: string;
    size: string;
  }[];
  usedSpace: string;
  maxAllowedSpace: string;
  blockedSince?: string;
};

/** What the worlds server will enforce for a scene deployed on the given parcels. */
export type WorldLimits = {
  maxSceneSizeInBytes: number;
};

export enum WorldPermissionType {
  Unrestricted = 'unrestricted',
  SharedSecret = 'shared-secret',
  NFTOwnership = 'nft-ownership',
  AllowList = 'allow-list',
}

export type UnrestrictedPermissionSetting = {
  type: WorldPermissionType.Unrestricted;
};

export type AllowListPermissionSetting = {
  type: WorldPermissionType.AllowList;
  wallets: string[];
  communities?: string[];
};

export type SharedSecretPermissionSetting = {
  type: WorldPermissionType.SharedSecret;
};

export type AddressWorldPermission = {
  permission: 'deployment' | 'streaming';
  worldWide: boolean; // If worldWide is set, parcels will not be returned
  parcelCount?: number;
};

export type WorldPermissions = {
  deployment: AllowListPermissionSetting;
  access:
    | AllowListPermissionSetting
    | UnrestrictedPermissionSetting
    | SharedSecretPermissionSetting;
  streaming: AllowListPermissionSetting | UnrestrictedPermissionSetting;
};

export type WorldPermissionsResponse = {
  permissions: WorldPermissions;
  summary: Record<string, AddressWorldPermission[]>;
  owner: string;
};

export enum WorldPermissionName {
  Deployment = 'deployment',
  Access = 'access',
  Streaming = 'streaming',
}

export type WorldParcelsResponse = {
  parcels: string[];
  total: number;
};

const WORLD_CONTENT_SERVER_URL = config.get('WORLDS_CONTENT_SERVER_URL');

export const WORLD_LIMITS_TIMEOUT_MS = 5000;
// POST /world/:name/scenes page size. Deployed scenes never share a parcel, so a chunk of this many
// coordinates overlaps at most one page of scenes and needs no paging.
const SCENE_LOOKUP_CHUNK_SIZE = 100;

/** A replaced scenes lookup answer that can't be used; reported to Sentry. */
class SceneLookupError extends Error {
  constructor(
    message: string,
    readonly extra: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'SceneLookupError';
  }
}

export class Worlds {
  private url = WORLD_CONTENT_SERVER_URL;

  private withIdentity(address: string): AuthIdentity {
    const identity = localStorageGetIdentity(address);
    if (!identity) {
      throw new Error('No identity found');
    }
    return identity;
  }

  public getContentSrcUrl(hash: string) {
    return `${this.url}/contents/${hash}`;
  }

  public async fetchWorlds(
    params: {
      limit?: number;
      offset?: number;
      search?: string;
      sort?: string;
      order?: 'asc' | 'desc';
      authorized_deployer?: string;
      has_deployed_scenes?: boolean;
    } = { limit: 100, offset: 0 },
  ): Promise<WorldDataResponse | null> {
    const queryString = formatQueryParams(params);
    const result = await fetch(`${this.url}/worlds?${queryString}`);
    if (result.ok) {
      const json = await result.json();
      return fromSnakeToCamel(json) as WorldDataResponse;
    } else {
      return null;
    }
  }

  public async fetchWorldScenes(
    worldName: string,
    params: {
      limit?: number;
      offset?: number;
      x1?: number;
      x2?: number;
      y1?: number;
      y2?: number;
    } = { limit: 100, offset: 0 },
  ) {
    try {
      const queryString = formatQueryParams(params);
      const encodedWorldName = encodeURIComponent(worldName);
      const result = await fetch(`${this.url}/world/${encodedWorldName}/scenes?${queryString}`);
      if (result.ok) {
        const json = await result.json();
        return json as WorldScenes;
      } else {
        return null;
      }
    } catch (_) {
      // Silent fail - world may not have scenes
    }

    return null;
  }

  public async fetchWorldSettings(worldName: string) {
    const encodedWorldName = encodeURIComponent(worldName);
    const result = await fetch(`${this.url}/world/${encodedWorldName}/settings`);
    if (result.ok) {
      const json = await result.json();
      if (json.thumbnail_hash) {
        json.thumbnail = this.getContentSrcUrl(json.thumbnail_hash);
      }
      return fromSnakeToCamel(json) as WorldSettings;
    } else {
      return null;
    }
  }

  public async putWorldSettings(
    address: string,
    worldName: string,
    settings: Partial<WorldSettings>,
  ): Promise<{ success: boolean; error?: string }> {
    const formData = new FormData();
    const formattedSettings = fromCamelToSnake(settings);

    for (const [key, value] of Object.entries(formattedSettings)) {
      if (key === 'thumbnail' && typeof value === 'string' && value.startsWith('data:')) {
        const blob = await fetch(value) // Convert base64 data URL to Blob for file upload
          .then(res => res.blob())
          .catch(() => 'null');
        formData.append(key, blob);
      } else if (Array.isArray(value)) {
        value.forEach(item => formData.append(key, String(item)));
      } else if (value !== undefined) {
        formData.append(key, String(value));
      } // Ignore undefined values similar to how JSON serialization works.
    }

    const encodedWorldName = encodeURIComponent(worldName);
    const result = await fetch(`${this.url}/world/${encodedWorldName}/settings`, {
      method: 'PUT',
      identity: this.withIdentity(address),
      body: formData,
    });

    // Parse error from response body for 400 Bad Request
    if (result.status === 400) {
      const { error } = await result.json().catch(() => ({ error: '' }));
      return { success: false, error };
    }

    return { success: result.status === 200 };
  }

  /** Unpublish a single scene from a world given one of the coordinates (any of them) from the scene */
  public async unpublishWorldScene(address: string, worldName: string, sceneCoord: string) {
    const encodedWorldName = encodeURIComponent(worldName);
    const encodedSceneCoords = encodeURIComponent(sceneCoord);
    const result = await fetch(
      `${this.url}/world/${encodedWorldName}/scenes/${encodedSceneCoords}`,
      {
        method: 'DELETE',
        identity: this.withIdentity(address),
      },
    );
    return result.status === 200;
  }

  /** Unpublish all scenes from a given world */
  public async unpublishEntireWorld(address: string, worldName: string) {
    const encodedWorldName = encodeURIComponent(worldName);
    const result = await fetch(`${this.url}/entities/${encodedWorldName}`, {
      method: 'DELETE',
      identity: this.withIdentity(address),
    });
    return result.status === 200;
  }

  public fetchWalletStats = async (address: string) => {
    try {
      const encodedAddress = encodeURIComponent(address);
      const result = await fetch(`${this.url}/wallet/${encodedAddress}/stats`);
      if (result.ok) {
        const json = await result.json();
        return json as WorldsWalletStats;
      } else {
        return null;
      }
    } catch (error) {
      return null;
    }
  };

  public fetchWorldLimits = async (
    worldName: string,
    parcels: string[],
    signal: AbortSignal,
  ): Promise<WorldLimits | null> => {
    const encodedWorldName = encodeURIComponent(worldName);
    const query = new URLSearchParams(parcels.map(parcel => ['parcels', parcel]));
    const sentryContext = {
      tags: { source: 'worlds', event: 'fetch-world-limits' },
      extra: { worldName, parcelCount: parcels.length },
    };
    try {
      const result = await fetch(`${this.url}/world/${encodedWorldName}/limits?${query}`, {
        signal,
      });
      if (!result.ok) {
        await result.body?.cancel().catch(() => undefined);
        // 404 is expected: a server without the endpoint, or a name the server won't deploy to.
        if (result.status !== 404) {
          captureException(new Error(`Failed to fetch world limits: ${result.status}`), {
            ...sentryContext,
            extra: { ...sentryContext.extra, status: result.status },
          });
        }
        return null;
      }
      let body: { maxSceneSizeInBytes?: unknown } | null;
      try {
        body = await result.json();
      } catch (error) {
        // A timed-out body read is not a malformed response.
        if (!signal.aborted) captureException(error, sentryContext);
        return null;
      }
      const maxSceneSizeInBytes = body?.maxSceneSizeInBytes;
      if (typeof maxSceneSizeInBytes !== 'string' || !/^\d+$/.test(maxSceneSizeInBytes)) {
        captureException(new Error('Invalid world limits response'), {
          ...sentryContext,
          extra: { ...sentryContext.extra, maxSceneSizeInBytes },
        });
        return null;
      }
      return { maxSceneSizeInBytes: Number(maxSceneSizeInBytes) };
    } catch (error) {
      console.warn('Failed to fetch world limits', error);
      return null;
    }
  };

  /**
   * Resolves the parcels of each deployed scene of the world overlapping `parcels`, the scenes a
   * deployment to them replaces, or `null` when they can't be looked up before `signal` aborts.
   */
  public fetchReplacedScenesParcels = async (
    worldName: string,
    parcels: string[],
    signal: AbortSignal,
  ): Promise<string[][] | null> => {
    const encodedWorldName = encodeURIComponent(worldName);
    const sentryContext = {
      tags: { source: 'worlds', event: 'fetch-replaced-scenes' },
      extra: { worldName, parcelCount: parcels.length },
    };
    // Aborted with the deadline, or when a chunk fails so the others stop.
    const lookup = new AbortController();
    const abortLookup = () => lookup.abort();
    signal.addEventListener('abort', abortLookup);
    if (signal.aborted) lookup.abort();
    const fetchChunk = async (coordinates: string[]) => {
      const result = await fetch(
        `${this.url}/world/${encodedWorldName}/scenes?limit=${SCENE_LOOKUP_CHUNK_SIZE}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ coordinates }),
          signal: lookup.signal,
        },
      );
      if (!result.ok) {
        await result.body?.cancel().catch(() => undefined);
        throw new SceneLookupError(`Failed to fetch the replaced scenes: ${result.status}`, {
          status: result.status,
        });
      }
      let page: Partial<WorldScenes> | null;
      try {
        page = await result.json();
      } catch (error) {
        // An aborted body read is not a malformed response.
        if (lookup.signal.aborted) throw error;
        throw new SceneLookupError('World scenes response is not JSON');
      }
      if (!Array.isArray(page?.scenes) || typeof page.total !== 'number') {
        throw new SceneLookupError('Invalid world scenes response', { total: page?.total });
      }
      // Only a full page can be cut short; a smaller one lists every match even when the count,
      // a separate query, saw a concurrent deploy.
      if (page.scenes.length >= SCENE_LOOKUP_CHUNK_SIZE && page.total > page.scenes.length) {
        throw new SceneLookupError('Truncated world scenes response', { total: page.total });
      }
      return page.scenes;
    };

    try {
      const chunks: string[][] = [];
      for (let start = 0; start < parcels.length; start += SCENE_LOOKUP_CHUNK_SIZE) {
        chunks.push(parcels.slice(start, start + SCENE_LOOKUP_CHUNK_SIZE));
      }
      const pages = await Promise.all(chunks.map(fetchChunk));
      // A scene overlapping several chunks is listed once per chunk.
      const replaced = new Map<string, string[]>();
      for (const scene of pages.flat()) replaced.set(scene.entityId, scene.parcels);
      return [...replaced.values()];
    } catch (error) {
      lookup.abort();
      if (error instanceof SceneLookupError) {
        captureException(error, {
          ...sentryContext,
          extra: { ...sentryContext.extra, ...error.extra },
        });
      } else {
        console.warn('Failed to fetch the replaced scenes', error);
      }
      return null;
    } finally {
      signal.removeEventListener('abort', abortLookup);
    }
  };

  public getPermissions = async (worldName: string) => {
    const encodedWorldName = encodeURIComponent(worldName);
    const result = await fetch(`${this.url}/world/${encodedWorldName}/permissions`);
    if (result.ok) {
      const json = await result.json();
      return fromSnakeToCamel(json) as WorldPermissionsResponse;
    } else {
      return null;
    }
  };

  public postPermissionType = async (
    authenticatedAddress: string,
    worldName: string,
    worldPermissionName: WorldPermissionName,
    worldPermissionType: WorldPermissionType,
    options?: {
      secret?: string;
      wallets?: string[];
      communities?: string[];
    },
  ) => {
    const metadata = {
      type: worldPermissionType,
      ...options,
    };

    const encodedWorldName = encodeURIComponent(worldName);
    const encodedPermissionName = encodeURIComponent(worldPermissionName);
    const result = await fetch(
      `${this.url}/world/${encodedWorldName}/permissions/${encodedPermissionName}`,
      {
        method: 'POST',
        identity: this.withIdentity(authenticatedAddress),
        metadata,
      },
    );
    return result.status === 204;
  };

  public putPermissionType = async (
    authenticatedAddress: string,
    worldName: string,
    worldPermissionName: WorldPermissionName,
    walletAddress: string,
  ) => {
    const encodedWorldName = encodeURIComponent(worldName);
    const encodedPermissionName = encodeURIComponent(worldPermissionName);
    const encodedWalletAddress = encodeURIComponent(walletAddress);
    const result = await fetch(
      `${this.url}/world/${encodedWorldName}/permissions/${encodedPermissionName}/${encodedWalletAddress}`,
      {
        method: 'PUT',
        identity: this.withIdentity(authenticatedAddress),
      },
    );
    return result.status === 204;
  };

  public deletePermissionType = async (
    authenticatedAddress: string,
    worldName: string,
    worldPermissionName: WorldPermissionName,
    walletAddress: string,
  ) => {
    const encodedWorldName = encodeURIComponent(worldName);
    const encodedPermissionName = encodeURIComponent(worldPermissionName);
    const encodedWalletAddress = encodeURIComponent(walletAddress);
    const result = await fetch(
      `${this.url}/world/${encodedWorldName}/permissions/${encodedPermissionName}/${encodedWalletAddress}`,
      {
        method: 'DELETE',
        identity: this.withIdentity(authenticatedAddress),
      },
    );
    return result.status === 204;
  };

  public fetchParcelsPermission = async (
    worldName: string,
    worldPermissionName: WorldPermissionName,
    walletAddress: string,
    params: {
      limit?: number;
      offset?: number;
      x1?: number;
      x2?: number;
      y1?: number;
      y2?: number;
    } = { limit: 100, offset: 0 },
  ) => {
    const queryString = formatQueryParams(params);
    const encodedWorldName = encodeURIComponent(worldName);
    const encodedPermissionName = encodeURIComponent(worldPermissionName);
    const encodedWalletAddress = encodeURIComponent(walletAddress);
    const result = await fetch(
      `${this.url}/world/${encodedWorldName}/permissions/${encodedPermissionName}/address/${encodedWalletAddress}/parcels?${queryString}`,
    );
    if (result.ok) {
      const json = await result.json();
      return json as WorldParcelsResponse;
    } else {
      return null;
    }
  };

  public postParcelsPermission = async (
    authenticatedAddress: string,
    worldName: string,
    worldPermissionName: WorldPermissionName,
    walletAddress: string,
    parcels: string[],
  ) => {
    const encodedWorldName = encodeURIComponent(worldName);
    const encodedPermissionName = encodeURIComponent(worldPermissionName);
    const encodedWalletAddress = encodeURIComponent(walletAddress);
    const result = await fetch(
      `${this.url}/world/${encodedWorldName}/permissions/${encodedPermissionName}/address/${encodedWalletAddress}/parcels`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        identity: this.withIdentity(authenticatedAddress),
        body: JSON.stringify({ parcels }),
      },
    );
    return result.status === 204;
  };

  public deleteParcelsPermission = async (
    authenticatedAddress: string,
    worldName: string,
    worldPermissionName: WorldPermissionName,
    walletAddress: string,
    parcels: string[],
  ) => {
    const encodedWorldName = encodeURIComponent(worldName);
    const encodedPermissionName = encodeURIComponent(worldPermissionName);
    const encodedWalletAddress = encodeURIComponent(walletAddress);
    const result = await fetch(
      `${this.url}/world/${encodedWorldName}/permissions/${encodedPermissionName}/address/${encodedWalletAddress}/parcels`,
      {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        identity: this.withIdentity(authenticatedAddress),
        body: JSON.stringify({ parcels }),
      },
    );
    return result.status === 204;
  };

  public fetchContributableDomains = async (address: string) => {
    const result = await fetch(`${this.url}/wallet/contribute`, {
      method: 'GET',
      identity: this.withIdentity(address),
    });

    if (result.ok) {
      const json: { domains: ContributableDomain[] } = await result.json();
      return json.domains;
    } else {
      throw new Error('Error while fetching contributable domains');
    }
  };
}
