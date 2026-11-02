import { type ChainId } from '@dcl/schemas/dist/dapps/chain-id';
import type { Locale } from './translation';

export type DeployOptions = {
  path: string;
  target?: string;
  targetContent?: string;
  language?: Locale;
  chainId: ChainId;
  wallet: string;
};

/** The CLI serving a deployment. */
export type DeployServer = {
  port: number;
  /** Whether the CLI serves the deploy resource (progress and cancel). */
  supportsDeployResource: boolean;
  /** Authorizes cancelling the deployment; absent when the CLI does not take `--deploy-token`. */
  deployToken?: string;
};
