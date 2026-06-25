import path from 'node:path';
import { randomUUID, type UUID } from 'node:crypto';
import { Analytics, type TrackParams } from '@segment/analytics-node';
import log from 'electron-log';
import { setUser } from '@sentry/electron/main';

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

/**
 * Detects and tracks first-install and app-update events once per launch by
 * comparing the current app version against markers persisted in config.json.
 * Must run before any other `track()` call so the existing-user check (presence
 * of `userId`) is not poisoned by the anonymous id that `track()` lazily creates.
 */
export async function trackLifecycleEvent(version: string): Promise<void> {
  try {
    const config = await getConfigStorage();
    const installedAt = await config.get('installedAt');
    const lastVersion = await config.get('lastVersion');
    // A persisted userId means analytics has run before on this machine, i.e. a
    // pre-existing user upgrading into this feature — not a fresh install.
    const isExistingUser = !!(await config.get('userId'));

    if (!installedAt && !lastVersion && !isExistingUser) {
      await track('Install Creator Hub', { version });
    } else if (lastVersion && lastVersion !== version) {
      await track('Update Creator Hub', { version, previous_version: lastVersion });
    }

    if (!installedAt) {
      await config.set('installedAt', new Date().toISOString());
    }
    await config.set('lastVersion', version);
  } catch (error) {
    log.error('Error tracking lifecycle event', error);
  }
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
    setUser({ id: userId });
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
