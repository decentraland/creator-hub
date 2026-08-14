import { ChainId } from '@dcl/schemas/dist/dapps/chain-id';
import { env } from '#preload';
import { config } from '/@/config';

export function isDev(chainId: ChainId): boolean {
  return chainId === ChainId.ETHEREUM_SEPOLIA;
}

export const REPORT_ISSUES_URL = config.get('REPORT_ISSUES_URL');
export const FEEDBACK_URL = config.get('FEEDBACK_URL');
export const HELP_FAQ_URL = config.get('HELP_FAQ_URL');
export const CONTACT_SUPPORT_URL = config.get('CONTACT_SUPPORT_URL');
export const DISCORD_URL = config.get('DISCORD_URL');
export const SUBMIT_EVENT_URL = 'https://decentraland.org/events/submit';

/** Where "Create Event" sends a Place owner. */
export const CREATE_EVENT_URL = 'https://decentraland.org/whats-on/new-hangout';

/**
 * Deeplink that hands a published world to the installed desktop client,
 * instead of opening the web page for it. Same scheme the publish flow uses;
 * `env.getEnv()` honours an `--env` override, which `getJumpInUrl` does not.
 */
export const getJumpInDeeplink = (world: string) => {
  const dclEnv = env.getEnv() === 'dev' ? 'zone' : 'org';
  return `decentraland://?realm=${world}&dclenv=${dclEnv}`;
};

/** Shareable web link for a published world. */
export const getJumpInUrl = (world: string) => {
  return import.meta.env.DEV
    ? `https://decentraland.zone/play/?realm=${config.get('WORLDS_CONTENT_SERVER_URL')}/world/${world}&NETWORK=sepolia`
    : `https://decentraland.org/play/world/${world}`;
};

/**
 * Shareable web link for a scene, wherever it lives.
 *
 * A Genesis City scene has no world to use as a realm — it is reached by
 * position, so a world link would point at a realm that does not exist.
 */
export const getSceneJumpInUrl = (location: { world?: string; x: number; y: number }) => {
  if (location.world) return getJumpInUrl(location.world);
  const base = import.meta.env.DEV ? 'https://decentraland.zone' : 'https://decentraland.org';
  return `${base}/play/?position=${location.x},${location.y}`;
};

export const getSceneJumpInDeeplink = (location: { world?: string; x: number; y: number }) => {
  const dclEnv = env.getEnv() === 'dev' ? 'zone' : 'org';
  return location.world
    ? getJumpInDeeplink(location.world)
    : `decentraland://?position=${location.x},${location.y}&dclenv=${dclEnv}`;
};
