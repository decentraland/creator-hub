import { ChainId } from '@dcl/schemas/dist/dapps/chain-id';
import { env } from '#preload';
import type { FeedbackContact } from '/shared/types/feedback';
import { config } from '/@/config';

export function isDev(chainId: ChainId): boolean {
  return chainId === ChainId.ETHEREUM_SEPOLIA;
}

export const FEEDBACK_URL = config.get('FEEDBACK_URL');
export const HELP_FAQ_URL = config.get('HELP_FAQ_URL');
export const CONTACT_SUPPORT_URL = config.get('CONTACT_SUPPORT_URL');
export const DISCORD_URL = config.get('DISCORD_URL');
export const CREATOR_FUND_URL = config.get('CREATOR_FUND_URL');
export const CREATOR_FUND_TERMS_URL = config.get('CREATOR_FUND_TERMS_URL');
export const CREATOR_FUND_RULES_URL = config.get('CREATOR_FUND_RULES_URL');

export const EMAIL_MAX_LENGTH = 254;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isEmail = (value: string) =>
  value.length <= EMAIL_MAX_LENGTH && EMAIL_PATTERN.test(value);

const DISCORD_USERNAME_PATTERN = /^(?!.*\.\.)[a-z0-9_.]{2,32}$/;

/** Strips a leading `@` and lowercases, as Discord stores usernames. */
export const normalizeDiscordUsername = (value: string) => value.replace(/^@/, '').toLowerCase();

export const isDiscordUsername = (value: string) => DISCORD_USERNAME_PATTERN.test(value);

/** Reads a typed contact as an email when it holds `@` past its first character, otherwise as a Discord username. */
export function parseContact(input: string): FeedbackContact | undefined {
  const value = input.trim();
  if (!value) return undefined;
  return value.indexOf('@') > 0
    ? { method: 'email', value }
    : { method: 'discord', value: normalizeDiscordUsername(value) };
}

export const isValidContact = ({ method, value }: FeedbackContact) =>
  method === 'email' ? isEmail(value) : isDiscordUsername(value);

/** Where every "Create Event" entry points: What's On's new-hangout page. */
export const CREATE_EVENT_URL = config.get('CREATE_EVENT_URL');

/**
 * Deeplink that hands a published world to the installed desktop client,
 * instead of opening the web page for it. Same scheme the publish flow uses;
 * `env.getEnv()` honours an `--env` override, which `getJumpInUrl` does not.
 */
export const getJumpInDeeplink = (world: string) => {
  const dclEnv = env.getEnv() === 'dev' ? 'zone' : 'org';
  return `decentraland://?realm=${world}&dclenv=${dclEnv}`;
};

/**
 * Shareable web link for a published world. Opens in the browser, so it works
 * for people without the desktop client installed. `/jump` is the canonical
 * path: the older `/play/world/<name>` form only 301-redirects to it. The dev
 * config jumps to the World on the dev Worlds content server.
 */
export const getJumpInUrl = (world: string) => {
  return config.get('ENVIRONMENT') === 'development'
    ? `${config.get('JUMP_URL')}?realm=${config.get('WORLDS_CONTENT_SERVER_URL')}/world/${world}&NETWORK=sepolia`
    : `${config.get('JUMP_URL')}?realm=${world}`;
};

/**
 * Shareable web link for a scene, wherever it lives.
 *
 * A Genesis City scene has no world to use as a realm — it is reached by
 * position, so a world link would point at a realm that does not exist.
 */
export const getSceneJumpInUrl = (location: { world?: string; x: number; y: number }) => {
  if (location.world) return getJumpInUrl(location.world);
  return `${config.get('JUMP_URL')}?position=${location.x},${location.y}`;
};

export const getSceneJumpInDeeplink = (
  location: { world?: string; x: number; y: number },
  { position = false }: { position?: boolean } = {},
) => {
  const dclEnv = env.getEnv() === 'dev' ? 'zone' : 'org';
  if (!location.world)
    return `decentraland://?position=${location.x},${location.y}&dclenv=${dclEnv}`;
  return position
    ? `decentraland://?realm=${location.world}&position=${location.x},${location.y}&dclenv=${dclEnv}`
    : getJumpInDeeplink(location.world);
};
