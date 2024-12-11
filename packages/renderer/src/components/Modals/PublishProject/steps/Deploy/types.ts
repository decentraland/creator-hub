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

export type DeploymentStatus = {
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

export class DeploymentError extends ErrorBase<Error> {}

export const isDeploymentError = (error: unknown, type: Error): error is DeploymentError =>
  error instanceof DeploymentError && error.name === type;
