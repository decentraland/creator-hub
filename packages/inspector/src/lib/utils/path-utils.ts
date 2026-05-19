/**
 * Returns the common directory prefix of all resource paths.
 * Used to compute the asset base path for relative path resolution.
 *
 * @example
 * getResourcesBasePath(['scene/assets/pack/sub/model.glb', 'scene/assets/pack/sub/tex.png'])
 * // => 'scene/assets/pack'
 *
 * getResourcesBasePath(['scene/assets/pack/model.glb'])
 * // => 'scene/assets'
 */
export function getResourcesBasePath(resources: string[]): string {
  if (resources.length === 0) return '';

  const pathParts = resources.map(path => path.split('/'));
  const minLength = Math.min(...pathParts.map(parts => parts.length));

  const commonParts: string[] = [];
  for (let i = 0; i < minLength - 1; i++) {
    const segment = pathParts[0][i];
    if (pathParts.every(parts => parts[i] === segment)) {
      commonParts.push(segment);
    } else {
      break;
    }
  }

  return commonParts.join('/');
}

/**
 * Returns the path relative to the base path.
 * If the full path is not under the base, returns the filename only (fallback).
 *
 * @example
 * getRelativeResourcePath('scene/assets/pack/sub/model.glb', 'scene/assets/pack')
 * // => 'sub/model.glb'
 *
 * getRelativeResourcePath('scene/assets/pack/model.glb', 'scene/assets/pack')
 * // => 'model.glb'
 */
export function getRelativeResourcePath(fullPath: string, basePath: string): string {
  if (!basePath) {
    return fullPath.split('/').pop() || fullPath;
  }

  const normalizedBase = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;
  if (fullPath === normalizedBase || fullPath.startsWith(normalizedBase + '/')) {
    const relative = fullPath.slice(normalizedBase.length);
    return relative.startsWith('/') ? relative.slice(1) : relative;
  }

  return fullPath.split('/').pop() || fullPath;
}
