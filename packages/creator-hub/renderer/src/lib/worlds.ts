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
  RatingPending = 'RP',
  Everyone = 'E',
  Teen = 'T',
  Adult = 'A',
  Restricted = 'R',
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
