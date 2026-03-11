import { getDomain } from './fetch-utils';

export const getContentUrl = () => `https://builder-items.decentraland.${getDomain()}`;
export const getRewardsServerUrl = () => `https://rewards.decentraland.${getDomain()}`;
