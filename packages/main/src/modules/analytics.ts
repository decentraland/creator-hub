import { Analytics, type TrackParams } from '@segment/analytics-node';
import log from 'electron-log';
import { randomUUID } from 'node:crypto';
import { config } from './config';

let analytics: Analytics | null = null;
const sessionId = randomUUID();
let _userId: string | null = null;

export function getUserId() {
  return _userId;
}

export function setUserId(userId: string) {
  _userId = userId;
}

export async function getAnonymousId() {
  const exists = await config.has('userId');
  if (!exists) {
    const userId = randomUUID();
    await config.set('userId', userId);
    return userId;
  }
  return config.get<string>('userId');
}

export async function getAnalytics(): Promise<Analytics | null> {
  if (analytics) {
    return analytics;
  }
  const writeKey = import.meta.env.VITE_SEGMENT_CREATORS_HUB_API_KEY;
  if (writeKey) {
    analytics = new Analytics({
      writeKey,
    });
    return analytics;
  } else {
    return null;
  }
}

export async function track(event: string, properties: Record<string, any> = {}) {
  try {
    const analytics = await getAnalytics();
    if (!analytics) return;
    const anonymousId = await getAnonymousId();
    const params: TrackParams = {
      event,
      properties: {
        ...properties,
        sessionId,
      },
      anonymousId,
    };
    const userId = getUserId();
    if (userId) {
      params.userId = userId;
    }
    analytics.track(params);
  } catch (error) {
    log.error('Error tracking event', event, error);
    // do nothing
  }
}

export async function identify(userId: string, traits: Record<string, any> = {}) {
  try {
    const analytics = await getAnalytics();
    if (!analytics) return;
    const anonymousId = await getAnonymousId();
    setUserId(userId);
    analytics.identify({ userId, anonymousId, traits });
  } catch (error) {
    log.error('Error identifying user', userId, error);
    // do nothing
  }
}
