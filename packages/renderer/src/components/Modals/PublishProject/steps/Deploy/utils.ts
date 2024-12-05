import { minutes, seconds } from '/shared/time';
import equal from 'fast-deep-equal';
import { delay } from '/shared/utils';

import type { DeploymentStatus } from './types';

export const getInitialDeploymentStatus = (): DeploymentStatus => ({
  catalyst: 'idle',
  assetBundle: 'idle',
  lods: 'idle',
});

export const retryDelayInMs = seconds(1); // TODO: CHANGE THIS TO 10 AFTER DEMO
// Estimated time as of 5/12/2024 for a full deployment is around 45 minutes.
export const maxRetries = minutes(45) / retryDelayInMs; // Total number of retries calculated based on a 45-minute retry window

/**
 * Fetch the deployment status.
 *
 * @returns A promise that resolves with the deployment status if successful.
 */
export async function fetchDeploymentStatus(): Promise<DeploymentStatus> {
  const response = await fetch('some-url');
  if (!response.ok) throw new Error(`Error fetching deployment status: ${response.status}`);
  const data = (await response.json()) as DeploymentStatus;
  return data;
}

/**
 * Periodically checks the deployment status and updates the caller with changes.
 * Retries the status check up to a maximum number of attempts or until the deployment succeeds.
 *
 * @param initialStatus - The initial deployment status to start with.
 * @param maxRetries - The maximum number of retries before considering the deployment a failure.
 * @param retryDelayInMs - The delay in milliseconds between consecutive retries.
 * @param onChange - A callback function triggered whenever the deployment status changes.
 * @param abort - A function that returns `true` if the status check should be aborted.
 * @throws {Error} Throws an error if the maximum retries are reached without success.
 */
export async function checkDeploymentStatus(
  initialStatus: DeploymentStatus,
  maxRetries: number,
  retryDelayInMs: number,
  onChange: (status: DeploymentStatus) => void,
  abort: () => boolean,
): Promise<void> {
  let currentStatus = initialStatus;
  let retries = 0;
  let error: Error | undefined = undefined;

  function _onChange(status: DeploymentStatus) {
    currentStatus = status;
    onChange(status);
  }

  while (retries < maxRetries) {
    try {
      if (abort()) return console.log('Deployment status check aborted...');
      const status = await fetchDeploymentStatus();
      if (!equal(currentStatus, status)) _onChange(status);
    } catch (e: any) {
      // TODO: THIS IS ONLY FOR DEMO. REMOVE IT BEFORE MERGING!!!!!!!!
      if (retries === 4) {
        _onChange({ ...currentStatus, catalyst: 'pending' });
      } else if (retries === 9) {
        _onChange({ ...currentStatus, catalyst: 'success', assetBundle: 'pending' });
      } else if (retries === 14) {
        _onChange({
          ...currentStatus,
          catalyst: 'success',
          assetBundle: 'success',
          lods: 'pending',
        });
      } else if (retries === 19) {
        _onChange({
          ...currentStatus,
          catalyst: 'success',
          assetBundle: 'success',
          lods: 'success',
        });
      }
      // TODO: REMOVE UNTIL HERE!!!!!!!!

      console.error(`Attempt ${retries + 1} failed.`, e);
      error = e;
    }

    retries++;

    // return if all components of the deployment are successful
    const allSuccessful = Object.values(currentStatus).every($ => $ === 'success');
    if (allSuccessful) return console.log('Deployment success!');

    if (retries < maxRetries) {
      console.log(`Retrying in ${retryDelayInMs}ms...`);
      await delay(retryDelayInMs);
    }
  }

  // if maximum retries are reached, log the error and throw
  const errMsg = 'Max retries reached. Deployment failed.';
  console.error(errMsg, error);
  throw new Error(errMsg, { cause: error });
}
