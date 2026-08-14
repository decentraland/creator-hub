export const STUDIOS_ADMIN_URL = 'https://studios-admin.decentraland.org';

export const GITHUB_RELEASES_URL = 'https://github.com/decentraland/creator-hub/releases/tag';
export const GITHUB_RELEASES_API_URL =
  'https://api.github.com/repos/decentraland/creator-hub/releases/tags';

/**
 * Joins the analytics API base with a request path.
 *
 * Shared so the renderer signs the exact pathname main requests — an ADR-44
 * signature covers the path, so a mismatch here reads as a 401 with no clue why.
 *
 * `path` must be relative: `new URL` ignores the base for an absolute URL, which
 * would let a path choose its own host and leave main's allowlist as the only
 * thing standing between the renderer and any origin.
 */
export function buildMetricsUrl(baseUrl: string, path: string): URL {
  if (/^[a-z][a-z\d+.-]*:/i.test(path)) {
    throw new Error(`Analytics API path must be a relative path (got ${path})`);
  }
  return new URL(path.replace(/^\//, ''), `${baseUrl.replace(/\/$/, '')}/`);
}
