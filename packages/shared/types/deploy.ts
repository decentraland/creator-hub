import { ErrorBase } from '/shared/types/error';

export const DEPLOY_URLS = {
  WORLDS: 'https://worlds-content-server.decentraland.org',
  TEST: 'https://peer-testing.decentraland.org',
  DEV_WORLDS: 'https://worlds-content-server.decentraland.zone',
  CATALYST_SERVER: 'https://peer.decentraland.org',
  DEV_CATALYST_SERVER: 'https://peer.decentraland.zone',
  ASSET_BUNDLE_REGISTRY: 'https://asset-bundle-registry.decentraland.org',
  DEV_ASSET_BUNDLE_REGISTRY: 'https://asset-bundle-registry.decentraland.zone',
};

export type File = {
  name: string;
  size: number;
};

export type Info = {
  baseParcel: string;
  debug: boolean;
  description: string;
  isPortableExperience: boolean;
  isWorld: boolean;
  parcels: string[];
  rootCID: string;
  skipValidations: boolean;
  title: string;
};

export const STATUS_VALUES = ['idle', 'pending', 'complete', 'failed'] as const;

export type Status = (typeof STATUS_VALUES)[number];

export type DeploymentComponentsStatus = {
  catalyst: Status;
  assetBundle: Status;
  lods: Status;
};

export type AssetBundleRegistryResponse = {
  complete: boolean;
  catalyst: string;
  assetBundles: {
    mac: string;
    windows: string;
  };
  lods: {
    mac: string;
    windows: string;
  };
};

export type Error = 'MAX_RETRIES' | 'FETCH';

export class DeploymentError extends ErrorBase<Error> {
  constructor(
    public name: Error,
    public message: string = '',
    public status: DeploymentComponentsStatus,
    public cause?: any,
  ) {
    super(name, message, cause);
    this.status = status;
  }
}

export const isDeploymentError = (error: unknown, type: Error): error is DeploymentError =>
  error instanceof DeploymentError && error.name === type;
