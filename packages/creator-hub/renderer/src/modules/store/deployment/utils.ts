import equal from 'fast-deep-equal';
import { getCatalystServersFromCache } from 'dcl-catalyst-client/dist/contracts-snapshots';
import { type SerializedError } from '@reduxjs/toolkit';
import { captureException } from '@sentry/electron/renderer';
import { type AuthChain, Authenticator } from '@dcl/crypto';
import { ChainId } from '@dcl/schemas';
import type { AuthIdentity } from 'decentraland-crypto-fetch';

import { minutes, seconds } from '/shared/time';
import { delay } from '/shared/utils';
import { fetch } from '/shared/fetch';

import { config } from '/@/config';
import { t } from '/@/modules/store/translation/utils';
import {
  type Info,
  type File,
  type AssetBundleRegistryResponse,
  type Status,
  type DeploymentComponentsStatus,
  STATUS_VALUES,
  DeploymentError,
} from '/@/lib/deploy';

export const MAX_FILE_SIZE_BYTES = 50 * 1e6; // 50MB defined in sdk-commands...
export const MAX_POINTER_SIZE_BYTES = 15 * 1e6; // 15MB validation in the content-server

const ASSET_BUNDLE_REGISTRY = config.get('ASSET_BUNDLE_REGISTRY_URL');
const ASSET_BUNDLE_REGISTRY_ABGEN = config.get('ASSET_BUNDLE_REGISTRY_ABGEN_URL');

export const getDeploymentUrl = (publishPort: number) => {
  const port = import.meta.env.VITE_CLI_DEPLOY_PORT || publishPort;
  return port ? `http://localhost:${port}/api` : null;
};

export const fetchFiles = async (url: string): Promise<File[]> => {
  if (!url) throw new Error('Invalid URL');
  const resp = await fetch(`${url}/files`);
  if (!resp.ok) throw new Error('Failed to fetch files');
  return resp.json();
};

export const fetchInfo = async (url: string): Promise<Info> => {
  if (!url) throw new Error('Invalid URL');
  const resp = await fetch(`${url}/info`);
  if (!resp.ok) throw new Error('Failed to fetch info');
  return resp.json();
};

export function getInvalidFiles(files: File[]) {
  return files.filter(file => file.size > MAX_FILE_SIZE_BYTES).map(file => file.name);
}

export const deploy = async (
  url: string,
  payload: {
    address: string;
    authChain: AuthChain;
    chainId: ChainId;
  },
) => {
  const resp = await fetch(
    `${url}/deploy`,
    {
      method: 'post',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
    seconds(30),
  );

  if (!resp.ok) {
    const data = await resp.json().catch(() => ({ message: `HTTP ${resp.status}` }));
    let error = data.message;
    console.log('[DEPLOY ERROR] raw data:', JSON.stringify(data));
    console.log('[DEPLOY ERROR] error message:', error);
    if (/Response was/.test(error)) {
      try {
        error = error.match(/\["(.*?)"\]/)?.[1] ?? error;
      } catch (e) {
        // Keep original error if parsing fails
      }
    }
    const serverError = new Error(error);
    captureException(serverError, {
      tags: { source: 'deployment', event: 'deploy-request' },
      extra: { status: resp.status, url },
    });
    throw serverError;
  }
};

export const getInitialDeploymentStatus = (): DeploymentComponentsStatus => ({
  catalyst: 'idle',
  assetBundle: 'idle',
});

export const retryDelayInMs = seconds(10);
// Estimated time as of 5/12/2024 for a full deployment is around 60 minutes.
export const maxRetries = minutes(60) / retryDelayInMs; // Total number of retries calculated based on a X-minute retry window

export const AUTH_CHAIN_HEADER_PREFIX = 'x-identity-auth-chain-';
export const AUTH_TIMESTAMP_HEADER = 'x-identity-timestamp';
export const AUTH_METADATA_HEADER = 'x-identity-metadata';

export function getAuthHeaders(
  method: string,
  path: string,
  chainProvider: (payload: string) => AuthChain,
): Record<string, string> {
  const timestamp = Date.now().toString();
  const metadata = JSON.stringify({}); // needed for the fetch to work...
  const payloadToSign = `${method.toLowerCase()}:${path.toLowerCase()}:${timestamp}:${metadata}`;

  const chain = chainProvider(payloadToSign);
  const headers = chain.reduce<Record<string, string>>((acc, link, index) => {
    acc[`${AUTH_CHAIN_HEADER_PREFIX}${index}`] = JSON.stringify(link);
    return acc;
  }, {});

  return {
    ...headers,
    [AUTH_TIMESTAMP_HEADER]: timestamp,
    [AUTH_METADATA_HEADER]: metadata,
  };
}

/**
 * Validates a status string against known values.
 *
 * @param status - The status string to validate.
 * @returns A valid `Status` or `failed` if invalid.
 */
export function validateStatus(status: string): Status {
  return STATUS_VALUES.includes(status as Status) ? (status as Status) : 'failed';
}

/**
 * Derives an overall deployment status from different statuses.
 *
 * @param statuses - The deployment statuses.
 * @returns An overall `Status`.
 */
export function deriveOverallStatus(statuses: Record<string, string>): Status {
  const _statuses: Set<Status> = new Set(Object.values(statuses) as Status[]);
  if (_statuses.has('failed')) return 'failed';
  if (_statuses.has('pending')) return 'pending';
  if (_statuses.has('complete')) return 'complete';
  return 'idle';
}

/**
 * Cleans up a `DeploymentStatus` object by resetting any 'pending' statuses to 'idle'.
 *
 * This function ensures that any deployment step stuck in a 'pending' state is treated
 * as 'idle' to indicate that it hasn't started or needs to be retried.
 *
 * @param status - The `DeploymentStatus` object containing the current statuses of deployment steps.
 * @returns A new `DeploymentStatus` object where all 'pending' statuses are replaced with 'idle'.
 */
export function cleanPendingsFromDeploymentStatus(
  status: DeploymentComponentsStatus,
): DeploymentComponentsStatus {
  return Object.fromEntries(
    Object.entries(status).map(([step, currentStatus]) => [
      step,
      currentStatus === 'pending' ? 'idle' : currentStatus,
    ]),
  ) as DeploymentComponentsStatus;
}

async function fetchEntityStatus(
  url: URL,
  headers: Record<string, string>,
): Promise<AssetBundleRegistryResponse> {
  const response = await fetch(url, { method: 'get', headers });

  if (!response.ok) {
    // A publish polls this until the deployment event reaches the registry, so the 404 branch
    // can run hundreds of times: release the body instead of leaving it to the collector.
    await response.body?.cancel().catch(() => undefined);
    throw new Error(`Error fetching deployment status: ${response.status}`);
  }

  return (await response.json()) as AssetBundleRegistryResponse;
}

/**
 * Fetches the deployment status for a given scene.
 *
 * LOD generation is deliberately not a deployment component: it keeps running on the registry
 * long after the scene is live, and creators should not wait on it to enter their scene. The
 * registry still reports a `lods` field — it is ignored on purpose.
 *
 * @param info - The scene info.
 * @param identity - The authentication identity for signing requests.
 * @param useAbgenRegistry - Whether asset-bundle status comes from the abgen registry.
 * @returns A promise resolving to the deployment status.
 */
export async function fetchDeploymentStatus(
  info: Info,
  identity: AuthIdentity,
  useAbgenRegistry: boolean = false,
): Promise<DeploymentComponentsStatus> {
  const { rootCID: sceneId } = info;
  const url = new URL(
    `/entities/status/${sceneId}`,
    useAbgenRegistry ? ASSET_BUNDLE_REGISTRY_ABGEN : ASSET_BUNDLE_REGISTRY,
  );
  const headers = getAuthHeaders('get', url.pathname, payload =>
    Authenticator.signPayload(identity, payload),
  );

  const status = await fetchEntityStatus(url, headers);

  return {
    catalyst: validateStatus(status.catalyst),
    assetBundle: deriveOverallStatus(status.assetBundles),
  };
}

/**
 * Periodically checks the deployment status and updates the caller with changes.
 * Retries the status check up to a maximum number of attempts or until the deployment succeeds.
 *
 * @param maxRetries - The maximum number of retries before considering the deployment a failure.
 * @param retryDelayInMs - The delay in milliseconds between consecutive retries.
 * @param fetchStatus - A promise function that resolves to a DeploymentStatus triggered on every retry.
 * @param onChange - A callback function triggered whenever the deployment status changes.
 * @param abort - A function that returns `true` if the status check should be aborted.
 * @param initialStatus - The initial deployment status to start with (defaults to 'idle' for every step).
 * @returns A promise resolving to the deployment status.
 * @throws {DeploymentError} Throws an error if the maximum retries are reached without success.
 */
export async function checkDeploymentStatus(
  maxRetries: number,
  retryDelayInMs: number,
  fetchStatus: () => Promise<DeploymentComponentsStatus>,
  onChange: (status: DeploymentComponentsStatus) => void,
  abort: () => boolean,
  initialStatus: DeploymentComponentsStatus = getInitialDeploymentStatus(),
): Promise<DeploymentComponentsStatus> {
  let currentStatus = initialStatus;
  let retries = 0;
  let error: Error | undefined = undefined;

  function _onChange(status: DeploymentComponentsStatus) {
    onChange(status);
    currentStatus = status;
  }

  while (retries < maxRetries) {
    try {
      if (abort()) {
        console.log('Deployment status check aborted...');
        return currentStatus;
      }
      const status = await fetchStatus();
      if (!equal(currentStatus, status)) _onChange(status);
    } catch (e: any) {
      error = new DeploymentError('FETCH_STATUS', currentStatus, e);
      console.error(error);
    }

    retries++;

    // return if all components of the deployment are successful
    const allSuccessful = Object.values(currentStatus).every($ => $ === 'complete');
    if (allSuccessful) {
      console.log('Deployment success!');
      return currentStatus;
    }

    if (retries < maxRetries) {
      console.log(
        `Attempt ${retries + 1}/${maxRetries} failed. Retrying in ${retryDelayInMs}ms...`,
      );
      await delay(retryDelayInMs);
    }
  }

  // if maximum retries are reached, log the error and throw
  const maxRetriesError = new DeploymentError('MAX_RETRIES', currentStatus, error);
  console.error(maxRetriesError);
  throw maxRetriesError;
}

export function getCatalystServers(chainId: ChainId) {
  const network = chainId === ChainId.ETHEREUM_SEPOLIA ? 'sepolia' : 'mainnet';
  return getCatalystServersFromCache(network);
}

export function getAvailableCatalystServer(triedServers: Set<string>, chainId: ChainId): string {
  const availableServers = [];

  for (const server of getCatalystServers(chainId)) {
    if (!triedServers.has(server.address)) {
      availableServers.push(server.address);
    }
  }

  if (availableServers.length === 0) {
    throw new Error('No available catalyst servers to try');
  }

  const randomIndex = Math.floor(Math.random() * availableServers.length);
  return availableServers[randomIndex];
}

export function translateError(error: SerializedError) {
  switch (error.name) {
    case 'INVALID_URL':
      return t('modal.publish_project.deploy.deploying.errors.invalid_url');
    case 'INVALID_IDENTITY':
      return t('modal.publish_project.deploy.deploying.errors.invalid_identity');
    case 'MAX_RETRIES':
      return t('modal.publish_project.deploy.deploying.errors.max_retries');
    case 'FETCH_STATUS':
      return t('modal.publish_project.deploy.deploying.errors.fetch_status');
    case 'FETCH_TIMEOUT_ERROR':
      return t('modal.publish_project.deploy.deploying.errors.fetch_timeout_error');
    case 'NO_INTERNET_CONNECTION':
      return t('modal.publish_project.deploy.deploying.errors.no_internet_connection');
    case 'CATALYST_SERVERS_EXHAUSTED':
      return t('modal.publish_project.deploy.deploying.errors.catalyst');
    case 'DEPLOYMENT_NOT_FOUND':
      return t('modal.publish_project.deploy.deploying.errors.not_found');
    case 'DEPLOYMENT_FAILED':
      return t('modal.publish_project.deploy.deploying.errors.failed');
    case 'MAX_FILE_SIZE_EXCEEDED':
      return t('modal.publish_project.deploy.deploying.errors.max_file_size_exceeded', {
        maxFileSizeInMb: MAX_FILE_SIZE_BYTES / 1e6,
      });
    case 'INVALID_CREATOR_WALLET':
      return t('modal.publish_project.deploy.deploying.errors.invalid_creator_wallet');
    case 'MAX_POINTER_SIZE_EXCEEDED':
      return t('modal.publish_project.deploy.deploying.errors.max_scene_size_exceeded');
    default:
      return t('modal.publish_project.deploy.deploying.errors.unknown');
  }
}

export function isMaxPointerSizeExceededError(error: any): boolean {
  if ('message' in error) {
    return /The deployment is too big/i.test(error.message);
  }

  return false;
}

export function isInvalidCreatorWalletError(error: any): boolean {
  if ('message' in error) {
    return error.message.includes('Creator must be a valid wallet address');
  }

  return false;
}
