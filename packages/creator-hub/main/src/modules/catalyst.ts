import { Env } from '/shared/types/env';

import { getEnvOverride } from './electron';

const PEER_URLS: Record<Env, string> = {
  [Env.DEV]: 'https://peer.decentraland.zone',
  [Env.PROD]: 'https://peer.decentraland.org',
};

/** The catalyst of the app's environment. */
export const getPeerUrl = () =>
  PEER_URLS[getEnvOverride() ?? (import.meta.env.DEV ? Env.DEV : Env.PROD)];
