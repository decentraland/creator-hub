import type { AuthIdentity } from '@dcl/crypto';
import { localStorageGetIdentity } from '@dcl/single-sign-on-client';
import fetch from 'decentraland-crypto-fetch';

import { config } from '/@/config';
import type { CreatorScenesStats } from '/shared/types/metrics';
import { fromSnakeToCamel } from '../modules/api';

export const METRICS_FEATURE_FLAG = 'creatorhub-creator-hub-metrics';
export const RANKING_FEATURE_FLAG = 'creatorhub-creator-hub-metrics-ranking';

export function isMetricsEnabled(flags: Record<string, boolean>): boolean {
  return !!flags[METRICS_FEATURE_FLAG];
}

export function isRankingEnabled(flags: Record<string, boolean>): boolean {
  return !!(flags && flags[RANKING_FEATURE_FLAG]);
}

const METRICS_API_URL = config.get('METRICS_API_URL');

export class Metrics {
  private url = METRICS_API_URL;

  private withIdentity(address: string): AuthIdentity {
    const identity = localStorageGetIdentity(address);
    if (!identity) {
      throw new Error('No identity found');
    }
    return identity;
  }

  public async fetchCreatorScenesStats(address: string): Promise<CreatorScenesStats> {
    const result = await fetch(`${this.url}/creators/me/scenes/stats`, {
      method: 'GET',
      identity: this.withIdentity(address),
    });
    if (!result.ok) {
      throw new Error(`Failed to fetch scene metrics (status ${result.status})`);
    }
    const json = await result.json();
    return fromSnakeToCamel(json) as CreatorScenesStats;
  }
}
