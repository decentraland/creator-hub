import { parseCoords } from '/@/lib/land';
import type { WorldScene, Worlds } from '/@/lib/worlds';

import type { WorldPermissionsState, WorldSettingsState } from './slice';

/**
 * Where a deployed scene sits, as the analytics API keys it.
 *
 * `scene.base` is the authoritative base parcel; the smallest parcel is the
 * fallback for a deployment whose metadata is missing it, so a scene is never
 * dropped for want of a coordinate.
 */
function sceneBase(scene: WorldScene): { x: number; y: number } | null {
  const candidate = scene.entity?.metadata?.scene?.base ?? [...(scene.parcels ?? [])].sort()[0];
  return candidate ? parseCoords(candidate) : null;
}

/**
 * Base coordinates of every scene deployed in a world, for analytics lookups.
 *
 * Never throws: this is enrichment on top of the worlds list, so a world whose
 * scenes cannot be listed still shows up everywhere it did before — it just has
 * no coordinates to ask analytics about.
 */
export async function fetchWorldSceneCoords(
  worldsApi: Worlds,
  worldName: string,
): Promise<Array<{ x: number; y: number }>> {
  try {
    const response = await worldsApi.fetchWorldScenes(worldName);
    return (response?.scenes ?? []).map(sceneBase).filter(coords => coords !== null);
  } catch {
    return [];
  }
}

export const getThumbnailUrlFromDeployment = (
  deployment:
    | {
        metadata?: { display: { navmapThumbnail: string } };
        content: { file: string; hash: string }[];
      }
    | undefined,
  getContentSrcUrl: (hash: string) => string,
) => {
  if (!deployment?.metadata?.display.navmapThumbnail) return '';
  const thumbnailFileName = deployment.metadata.display.navmapThumbnail;
  const thumbnailContent = deployment.content.find(item => item.file === thumbnailFileName);
  if (thumbnailContent) return getContentSrcUrl(thumbnailContent.hash);
  return '';
};

export const getWorldSettingsInitialState = (): WorldSettingsState => ({
  worldName: '',
  settings: {},
  scenes: [],
  status: 'idle',
  error: null,
});

export const getWorldPermissionsInitialState = (): WorldPermissionsState => ({
  worldName: '',
  owner: '',
  permissions: null,
  summary: {},
  parcels: {},
  loadingNewUser: false,
  status: 'idle',
  error: null,
});
