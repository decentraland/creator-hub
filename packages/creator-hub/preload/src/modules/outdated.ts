import semver from 'semver';

import type { DistTags, Outdated } from '/shared/types/npm';

export const AUTH_SERVER_TAG = 'auth-server';

type OutdatedInfo = Outdated[string];

/**
 * Returns the "major.minor.patch" core of a version, ignoring any prerelease or
 * build-metadata suffix, or null when the value can't be parsed as a semver.
 */
function getBaseVersion(version: string): string | null {
  const parsed = semver.parse(version, { loose: true });
  return parsed ? `${parsed.major}.${parsed.minor}.${parsed.patch}` : null;
}

/**
 * Decides whether (and how) an outdated package reported by `npm outdated` should
 * surface an update prompt, accounting for non-official builds.
 *
 * `npm outdated` only knows about the `latest` dist-tag, so it flags any installed
 * version that differs from it — including experimental/auth-server commit builds
 * such as `7.24.3-28199504206.commit-1a6c780`, even when "updating" to `latest`
 * would actually be a downgrade. This narrows that down to:
 *
 *  - A prerelease/commit build of the official `latest` line (e.g.
 *    `7.24.3-<run>.commit-<hash>` while latest is `7.24.3`) is NOT outdated.
 *  - A build on the `auth-server` line is never pushed to the official latest:
 *    if it's the current auth-server build it's up to date; if it's an older
 *    build on that line, the update target is rewritten to the auth-server build.
 *
 * @param info - The `{ current, latest }` entry reported by `npm outdated`.
 * @param distTags - The package's dist-tags (`npm view <pkg> dist-tags`).
 * @returns The (possibly rewritten) outdated info, or `null` to suppress it.
 */
export function resolveOutdated(info: OutdatedInfo, distTags: DistTags): OutdatedInfo | null {
  const { current, latest } = info;

  // Leave anything we can't reason about (git/file specifiers, etc.) untouched.
  if (!semver.valid(current, { loose: true })) return info;

  const currentBase = getBaseVersion(current);
  const latestBase = getBaseVersion(latest);

  // Same release as the official latest, just a prerelease/commit build of it.
  if (currentBase && latestBase && currentBase === latestBase && current !== latest) {
    return null;
  }

  const authServer = distTags[AUTH_SERVER_TAG];
  if (authServer && semver.valid(authServer, { loose: true })) {
    // Already on the current auth-server build: nothing to update.
    if (current === authServer) return null;

    // On the same release line as the auth-server build.
    if (currentBase && currentBase === getBaseVersion(authServer)) {
      // Older build on that line -> offer the next auth-server build, never official latest.
      if (semver.lt(current, authServer, { loose: true })) {
        return { current, latest: authServer };
      }
      // Same line but not behind the auth-server build -> nothing to offer.
      return null;
    }
  }

  // Genuinely behind the official latest.
  return info;
}
