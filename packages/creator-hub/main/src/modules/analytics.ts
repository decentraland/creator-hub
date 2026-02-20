import path from 'node:path';
import { randomUUID, type UUID } from 'node:crypto';
import { Analytics, type TrackParams } from '@segment/analytics-node';
import log from 'electron-log';
import * as Sentry from '@sentry/electron/main';

import { FileSystemStorage } from '/shared/types/storage';
import type { ProjectInfo } from '/shared/types/projects';

import { getConfigStorage } from './config';
import { getWorkspaceConfigPath } from './electron';
import type { Events } from '/shared/types/analytics';

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
  const config = await getConfigStorage();
  const userId = await config.get('userId');
  if (!userId) {
    const uuid = randomUUID();
    await config.set('userId', uuid);
    return uuid;
  }
  return userId;
}

export function getAnalytics(): Analytics | null {
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

/** Recursively serializes arrays of objects to avoid "[object Object]" in analytics properties */
const serializeProperties = (properties: Record<string, any> | undefined): Record<string, any> => {
  const serialized: Record<string, any> = {};
  if (!properties) return serialized;
  for (const [key, value] of Object.entries(properties || {})) {
    if (Array.isArray(value) && value.some(item => typeof item === 'object')) {
      serialized[key] = JSON.stringify(value);
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      serialized[key] = serializeProperties(value);
    } else {
      serialized[key] = value;
    }
  }
  return serialized;
};

export async function track<T extends keyof Events>(
  eventName: T,
  properties: Events[T],
): Promise<void> {
  try {
    const analytics = getAnalytics();
    if (!analytics) return;
    const anonymousId = await getAnonymousId();

    const serializedProperties = serializeProperties(properties);

    const params: TrackParams = {
      event: eventName,
      properties: {
        ...serializedProperties,
        os: process.platform,
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
    const analytics = getAnalytics();
    if (!analytics) return;
    const anonymousId = await getAnonymousId();
    setUserId(userId);
    analytics.identify({ userId, anonymousId, traits });
    Sentry.setUser({ id: userId });
  } catch (error) {
    log.error('Error identifying user', userId, error);
    // do nothing
  }
}

export async function getProjectId(_path: string): Promise<UUID> {
  const projectInfoPath = path.join(await getWorkspaceConfigPath(_path), 'project.json');
  const projectInfo = await FileSystemStorage.getOrCreate<ProjectInfo>(projectInfoPath);
  const id = await projectInfo.get('id');
  if (!id) {
    const projectId = randomUUID();
    await projectInfo.set('id', projectId);
    return projectId;
  }
  return id as UUID;
}
