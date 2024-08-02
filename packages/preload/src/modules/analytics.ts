import { invoke } from './invoke';

export async function track(event: string, data?: Record<string, any>) {
  await invoke('analytics.track', event, data);
}
