import semver from 'semver';

import type { Outdated } from '/shared/types/npm';

type OutdatedInfo = Outdated[string];

/**
 * Decides whether an outdated package reported by `npm outdated` should surface
 * an update prompt.
 *
 * `npm outdated` only knows about the `latest` dist-tag, so it flags any installed
 * version that differs from it — including auth-server/experimental commit builds
 * such as `7.24.3-28199504206.commit-1a6c780`, where "updating" to `latest` would
 * pull the scene off the line it was deliberately pinned to (and may even be a
 * downgrade). A version string alone can't tell which dist-tag such a build came
 * from, so instead of guessing we only prompt when the installed version is a
 * clean official release (`7.23.0`, `7.11.2`, ...) that is behind `latest`.
 * Anything with a prerelease or build suffix — or that isn't a valid semver at
 * all (git/file specifiers) — never prompts.
 *
 * @param info - The `{ current, latest }` entry reported by `npm outdated`.
 * @returns The outdated info when an update should be offered, or `null` to suppress it.
 */
export function resolveOutdated(info: OutdatedInfo): OutdatedInfo | null {
  const { current, latest } = info;

  const parsed = semver.parse(current, { loose: true });
  if (!parsed || parsed.prerelease.length > 0 || parsed.build.length > 0) {
    return null;
  }

  // A clean release can still be at or ahead of `latest` (e.g. a not-yet-published
  // version); prompting there would offer a no-op or a downgrade.
  if (!semver.valid(latest, { loose: true }) || !semver.lt(current, latest, { loose: true })) {
    return null;
  }

  return info;
}
