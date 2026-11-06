import { vi } from 'vitest';

import type { Events } from '/shared/types/analytics';

import { analytics } from '#preload';

/** Every payload the renderer tracked under `event`, oldest first. */
export const tracked = <E extends keyof Events>(event: E) =>
  vi
    .mocked(analytics.track)
    .mock.calls.filter(([name]) => name === event)
    .map(([, data]) => data as Events[E]);

/** Whether any tracked event carried one of `values`, anywhere in its payload. */
export const trackedAnyOf = (values: string[]) => {
  const sent = JSON.stringify(vi.mocked(analytics.track).mock.calls);
  return values.some(value => sent.includes(value));
};
