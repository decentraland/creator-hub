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
