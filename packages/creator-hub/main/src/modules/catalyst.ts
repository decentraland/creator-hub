import { Env } from '/shared/types/env';

import { getEnvOverride } from './electron';

const PEER_URLS: Record<Env, string> = {
  [Env.DEV]: 'https://peer.decentraland.zone',
  [Env.PROD]: 'https://peer.decentraland.org',
};

const WORLDS_CONTENT_URLS: Record<Env, string> = {
  [Env.DEV]: 'https://worlds-content-server.decentraland.zone',
  [Env.PROD]: 'https://worlds-content-server.decentraland.org',
};

const appEnv = () => getEnvOverride() ?? (import.meta.env.DEV ? Env.DEV : Env.PROD);

/** The catalyst of the app's environment. */
export const getPeerUrl = () => PEER_URLS[appEnv()];

/** The Worlds content server of the app's environment. */
export const getWorldsContentUrl = () => WORLDS_CONTENT_URLS[appEnv()];
