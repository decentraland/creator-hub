import { Analytics } from '@segment/analytics-node';
import log from 'electron-log';
import { randomUUID } from 'node:crypto';
import { config } from './config';

let analytics: Analytics | null = null;

export async function getUserId() {
  const exists = await config.has('userId');
  if (!exists) {
    const userId = randomUUID();
    await config.set('userId', userId);
    return userId;
  }
  return config.get<string>('userId');
}

export async function getAnalytics(): Promise<Analytics> {
  if (analytics) {
    return analytics;
  }
  const writeKey = process.env.SEGMENT_EDITOR_API_KEY!;
  if (writeKey) {
    analytics = new Analytics({
      writeKey: process.env.SEGMENT_EDITOR_API_KEY!,
    });
    analytics.identify({
      userId: await getUserId(),
      traits: {
        appId: 'desktop-editor',
      },
    });
    return analytics;
  } else {
    throw new Error('No analytics key found');
  }
}

export async function track(event: string, data: Record<string, any> = {}) {
  try {
    const analytics = await getAnalytics();
    const userId = await getUserId();
    console.log('track', event, data, userId);
    analytics.track({ event, properties: data, userId });
  } catch (error) {
    log.error('Error tracking event', event, error);
    // do nothing
  }
}
