import { invoke } from './invoke';

export async function track(event: string, data?: Record<string, any>) {
  await invoke('analytics.track', event, data);
}

export async function identify(userId: string, traits?: Record<string, any>) {
  await invoke('analytics.identify', userId, traits);
}

export async function getAnonymousId() {
  return invoke('analytics.getAnonymousId');
}
