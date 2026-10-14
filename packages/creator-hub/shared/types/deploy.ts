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
  /** Authorizes cancelling the deployment; absent when the CLI predates the deploy resource. */
  deployToken?: string;
};
