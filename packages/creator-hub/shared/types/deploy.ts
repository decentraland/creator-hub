import { type ChainId } from '@dcl/schemas/dist/dapps/chain-id';
import type { Locale } from './translation';

export type DeployOptions = {
  path: string;
  target?: string;
  targetContent?: string;
  language?: Locale;
  chainId: ChainId;
  wallet: string;
  isMultiScene?: boolean;  // When false (default), existing world scenes are replaced; when true, scenes accumulate
};
