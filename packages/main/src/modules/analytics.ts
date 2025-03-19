import { Analytics, type TrackParams } from '@segment/analytics-node';
import path from 'node:path';
import log from 'electron-log';
import { randomUUID, type UUID } from 'node:crypto';

import { FileSystemStorage } from '/shared/types/storage';
import type { ProjectInfo } from '/shared/types/projects';

import { getConfig } from './config';
import { getWorkspaceConfigPath } from './electron';

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
  const config = await getConfig();
  const userId = await config.get('userId');
  if (!userId) {
    const uuid = randomUUID();
    await config.set('userId', uuid);
    return uuid;
  }
  return userId;
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
