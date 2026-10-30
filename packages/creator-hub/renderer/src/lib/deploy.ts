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

export type DeploymentStatus = Status | 'cancelled';

/** Phases of the sdk-commands local deploy resource (`/api/deploy`). */
export type DeployPhase =
  | 'awaiting-signature'
  | 'undeploying'
  | 'uploading'
  | 'deployed'
  | 'failed'
  | 'cancelled';

export type DeployUpload = {
  stage: 'checking' | 'uploading' | 'processing';
  sentBytes: number;
  totalBytes: number;
  completedBatches: number | null;
  totalBatches: number | null;
};

export type DeployState = {
  phase: DeployPhase;
  upload: DeployUpload | null;
  result: { entityId: string; message?: string } | null;
  error: { code: string; message: string } | null;
  /** Whether a cancellation is under way; absent on CLIs that predate it. */
  cancelRequested?: boolean;
};

export type DeploymentComponentsStatus = {
  catalyst: Status;
  assetBundle: Status;
};

export type AssetBundleRegistryResponse = {
  complete: boolean;
  catalyst: string;
  assetBundles: {
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
  | 'INVALID_CREATOR_WALLET'
  | 'DEPLOYMENT_CANCELLED'
  | 'DEPLOY_STATE_LOST'
  | 'DEPLOY_REQUEST_TIMEOUT';

export class DeploymentError extends ErrorBase<ErrorName> {
  constructor(
    public name: ErrorName,
    public status: DeploymentComponentsStatus,
    public error?: Error,
  ) {
    super(name, error?.message || `Deployment error: ${name}`);
  }
}

export const isDeploymentError = (
  error: unknown,
  type: ErrorName | ErrorName[] | '*',
): error is DeploymentError =>
  error instanceof DeploymentError &&
  (Array.isArray(type) ? type.includes(error.name) : type === '*' || error.name === type);
