import { t } from '/@/modules/store/translation/utils';

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

export type Error =
  | 'MAX_RETRIES'
  | 'FETCH'
  | 'CATALYST_SERVERS_EXHAUSTED'
  | 'DEPLOYMENT_NOT_FOUND'
  | 'DEPLOYMENT_FAILED'
  | 'INVALID_URL'
  | 'INVALID_IDENTITY';

export class DeploymentError extends ErrorBase<Error> {
  constructor(
    public name: Error,
    public status: DeploymentComponentsStatus,
    public cause?: any,
    public message = '',
  ) {
    super(name, message, cause);
    this.status = status;

    if (!message) {
      switch (name) {
        case 'INVALID_URL':
          this.message = t('modal.publish_project.deploy.deploying.errors.invalid_url');
          break;
        case 'INVALID_IDENTITY':
          this.message = t('modal.publish_project.deploy.deploying.errors.invalid_identity');
          break;
        case 'MAX_RETRIES':
          this.message = t('modal.publish_project.deploy.deploying.errors.max_retries');
          break;
        case 'FETCH':
          this.message = t('modal.publish_project.deploy.deploying.errors.fetch');
          break;
        case 'CATALYST_SERVERS_EXHAUSTED':
          this.message = t('modal.publish_project.deploy.deploying.errors.catalyst');
          break;
        case 'DEPLOYMENT_NOT_FOUND':
          this.message = t('modal.publish_project.deploy.deploying.errors.not_found');
          break;
        case 'DEPLOYMENT_FAILED':
          this.message = t('modal.publish_project.deploy.deploying.errors.failed');
          break;
        default:
          this.message = t('modal.publish_project.deploy.deploying.errors.unknown');
          break;
      }
    }
  }
}

export const isDeploymentError = (
  error: unknown,
  type: Error | Error[] | '*',
): error is DeploymentError =>
  error instanceof DeploymentError &&
  (Array.isArray(type) ? type.includes(error.name) : type === '*' || error.name === type);
