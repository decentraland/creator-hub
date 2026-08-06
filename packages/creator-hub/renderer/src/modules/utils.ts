import { ChainId } from '@dcl/schemas/dist/dapps/chain-id';
import { env } from '#preload';
import { config } from '/@/config';

export function isDev(chainId: ChainId): boolean {
  return chainId === ChainId.ETHEREUM_SEPOLIA;
}

export const REPORT_ISSUES_URL = config.get('REPORT_ISSUES_URL');
export const FEEDBACK_URL = config.get('FEEDBACK_URL');
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
