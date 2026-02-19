import { captureException } from '@sentry/electron/renderer';
import { ErrorBase } from '/shared/types/error';

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

export type ErrorName =
  | 'MAX_RETRIES'
  | 'FETCH_STATUS'
  | 'FETCH_TIMEOUT_ERROR'
  | 'NO_INTERNET_CONNECTION'
  | 'CATALYST_SERVERS_EXHAUSTED'
  | 'DEPLOYMENT_NOT_FOUND'
  | 'DEPLOYMENT_FAILED'
  | 'INVALID_URL'
  | 'INVALID_IDENTITY'
  | 'MAX_FILE_SIZE_EXCEEDED'
  | 'MAX_POINTER_SIZE_EXCEEDED'
  | 'INVALID_CREATOR_WALLET';

export class DeploymentError extends ErrorBase<ErrorName> {
  constructor(
    public name: ErrorName,
    public status: DeploymentComponentsStatus,
    public error?: Error,
  ) {
    super(name, error?.message || `Deployment error: ${name}`);
    // Report the error to Sentry
    captureException(error || this, {
      tags: {
        source: 'deployment',
        errorType: name,
      },
      fingerprint: ['deployment-error', name],
    });
  }
}

export const isDeploymentError = (
  error: unknown,
  type: ErrorName | ErrorName[] | '*',
): error is DeploymentError =>
  error instanceof DeploymentError &&
  (Array.isArray(type) ? type.includes(error.name) : type === '*' || error.name === type);
