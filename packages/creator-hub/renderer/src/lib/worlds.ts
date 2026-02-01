import type { AuthIdentity, AuthChain } from '@dcl/crypto';
import { localStorageGetIdentity } from '@dcl/single-sign-on-client';
import type { Entity, IPFSv2 } from '@dcl/schemas';
import fetch from 'decentraland-crypto-fetch';

import { config } from '/@/config';
import type { ContributableDomain } from '/@/modules/store/ens/types';
import { fromCamelToSnake, fromSnakeToCamel } from '../modules/api';

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
  allowedMediaHostnames?: any[];
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
  thumbnailUrl?: string;
  contentRating?: SceneAgeRating;
  categories?: SceneCategory[];
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
};

export type AddressWorldPermission = {
  permission: 'deployment' | 'streaming';
  world_wide: boolean; // If world_wide is set, parcels will not be returned
  parcel_count?: number;
};

export type WorldPermissions = {
  deployment: AllowListPermissionSetting;
  access: AllowListPermissionSetting | UnrestrictedPermissionSetting;
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

  public async fetchWorld(name: string) {
    try {
      const result = await fetch(`${this.url}/entities/active`, {
        method: 'POST',
        body: JSON.stringify({
          pointers: [name],
        }),
      });
      if (result.ok) {
        const json = await result.json();
        return json as WorldDeployment[];
      } else {
        return null;
      }
    } catch (_) {
      /* empty */
    }

    return null;
  }

  public async fetchWorldScenes(worldName: string) {
    try {
      const result = await fetch(`${this.url}/world/${worldName}/scenes`);
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

  public async fetchWorldSettings(
    worldName: string,
    limit: number = 100,
    offset: number = 0,
    coordinates: string[] = [],
  ) {
    const urlParams = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
      coordinates: coordinates.toString(),
    });

    const result = await fetch(`${this.url}/world/${worldName}/settings?${urlParams.toString()}`);
    if (result.ok) {
      const json = await result.json();
      return fromSnakeToCamel(json) as WorldSettings;
    } else {
      return null;
    }
  }

  public async putWorldSettings(
    address: string,
    worldName: string,
    settings: Partial<WorldSettings>,
  ) {
    const formData = new FormData();
    const formattedSettings = fromCamelToSnake(settings);

    Object.entries(formattedSettings).forEach(([key, value]) => {
      if (value !== undefined) {
        if (Array.isArray(value)) {
          value.forEach(item => formData.append(key, String(item)));
        } else {
          formData.append(key, String(value));
        }
      }
    });

    const result = await fetch(`${this.url}/world/${worldName}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'multipart/form-data' },
      identity: this.withIdentity(address),
      body: formData,
    });
    return result.status === 204;
  }

  public async unpublishWorldScene(address: string, worldName: string, sceneCoords: string) {
    const result = await fetch(`${this.url}/world/${worldName}/scenes/${sceneCoords}`, {
      method: 'DELETE',
      identity: this.withIdentity(address),
    });
    return result.status === 204;
  }

  public fetchWalletStats = async (address: string) => {
    try {
      const result = await fetch(`${this.url}/wallet/${address}/stats`);
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
    const result = await fetch(`${this.url}/world/${worldName}/permissions`);
    if (result.ok) {
      const json: WorldPermissionsResponse = await result.json();
      return json;
    } else {
      return null;
    }
  };

  public postPermissionType = async (
    authenticatedAddress: string,
    worldName: string,
    worldPermissionName: WorldPermissionName,
    worldPermissionType: WorldPermissionType,
  ) => {
    const result = await fetch(
      `${this.url}/world/${worldName}/permissions/${worldPermissionName}`,
      {
        method: 'POST',
        identity: this.withIdentity(authenticatedAddress),
        metadata: {
          type: worldPermissionType,
        },
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
    const result = await fetch(
      `${this.url}/world/${worldName}/permissions/${worldPermissionName}/${walletAddress}`,
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
    const result = await fetch(
      `${this.url}/world/${worldName}/permissions/${worldPermissionName}/${walletAddress}`,
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
    params?: {
      limit?: number;
      offset?: number;
      x1?: number;
      x2?: number;
      y1?: number;
      y2?: number;
    },
  ) => {
    const urlParams = new URLSearchParams(
      Object.entries(params || {}).map(([key, value]) => [key, value?.toString()]),
    );
    const result = await fetch(
      `${this.url}/world/${worldName}/permissions/${worldPermissionName}/address/${walletAddress}/parcels?${urlParams.toString()}`,
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
    const result = await fetch(
      `${this.url}/world/${worldName}/permissions/${worldPermissionName}/address/${walletAddress}/parcels`,
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
    const result = await fetch(
      `${this.url}/world/${worldName}/permissions/${worldPermissionName}/address/${walletAddress}/parcels`,
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
