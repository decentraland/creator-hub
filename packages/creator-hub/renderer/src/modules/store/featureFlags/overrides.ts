/**
 * Locally forced feature flags.
 *
 * A flag the service does not know yet is off everywhere, which leaves no way
 * to open a feature that is still being built behind one. In development the
 * flags fetched from the service are merged with whatever this key holds:
 *
 *   localStorage.setItem('creator-hub:feature-flags', '{"creatorhub-analytics":true}')
 *
 * Never applied in a release build.
 */
export const FLAG_OVERRIDES_KEY = 'creator-hub:feature-flags';

export function applyFlagOverrides(
  flags: Record<string, boolean>,
  storage: Pick<Storage, 'getItem'> = localStorage,
): Record<string, boolean> {
  if (!import.meta.env.DEV) return flags;

  let raw: string | null = null;
  try {
    raw = storage.getItem(FLAG_OVERRIDES_KEY);
  } catch {
    return flags; // storage unavailable
  }
  if (!raw) return flags;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.warn(`[featureFlags] ${FLAG_OVERRIDES_KEY} is not valid JSON; ignoring it`);
    return flags;
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    console.warn(`[featureFlags] ${FLAG_OVERRIDES_KEY} must be an object of flag booleans`);
    return flags;
  }

  // Only booleans, so a typo cannot switch a flag on with a truthy string.
  const overrides = Object.fromEntries(
    Object.entries(parsed as Record<string, unknown>).filter(
      ([, value]) => typeof value === 'boolean',
    ),
  ) as Record<string, boolean>;

  if (Object.keys(overrides).length) {
    console.info('[featureFlags] applying local overrides:', overrides);
  }
  return { ...flags, ...overrides };
}
