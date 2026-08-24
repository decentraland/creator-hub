export const STUDIOS_ADMIN_URL = 'https://studios-admin.decentraland.org';

export const GITHUB_RELEASES_URL = 'https://github.com/decentraland/creator-hub/releases/tag';
export const GITHUB_RELEASES_API_URL =
  'https://api.github.com/repos/decentraland/creator-hub/releases/tags';

/**
 * Joins the analytics API base with a request path.
 *
 * Shared so the renderer signs the exact pathname main requests — an ADR-44
 * signature covers the path, so a mismatch here reads as a 401 with no clue why.
 */
export function buildMetricsUrl(baseUrl: string, path: string): URL {
  return new URL(path.replace(/^\//, ''), `${baseUrl.replace(/\/$/, '')}/`);
}
