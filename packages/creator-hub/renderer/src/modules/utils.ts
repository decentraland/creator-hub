import { ChainId } from '@dcl/schemas/dist/dapps/chain-id';
import { config } from '/@/config';

export function isDev(chainId: ChainId): boolean {
  return chainId === ChainId.ETHEREUM_SEPOLIA;
}

export const REPORT_ISSUES_URL = config.get('REPORT_ISSUES_URL');
export const FEEDBACK_URL = config.get('FEEDBACK_URL');
export const SUBMIT_EVENT_URL = 'https://decentraland.org/events/submit';

/** Link that opens a published world in the explorer. */
export const getJumpInUrl = (world: string) => {
  return import.meta.env.DEV
    ? `https://decentraland.zone/play/?realm=${config.get('WORLDS_CONTENT_SERVER_URL')}/world/${world}&NETWORK=sepolia`
    : `https://decentraland.org/play/world/${world}`;
};
