import { getDomain } from './fetch-utils';

export const URLS = () => ({
  CONTENT_URL: `https://builder-items.decentraland.${getDomain()}`,
  REWARDS_SERVER_URL: `https://rewards.decentraland.${getDomain()}`,
});

export const CONTENT_URL = URLS().CONTENT_URL;
export const REWARDS_SERVER_URL = URLS().REWARDS_SERVER_URL;
