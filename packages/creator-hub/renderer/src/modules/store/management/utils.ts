import type { ManagedProject } from '/shared/types/manage';
import { ManagedProjectType } from '/shared/types/manage';
import { retry } from '/shared/utils';

import { parseCoords } from '/@/lib/land';
import type { WorldData, WorldScene, Worlds } from '/@/lib/worlds';
import { WorldRoleType } from '/@/lib/worlds';

import type { WorldPermissionsState, WorldSettingsState } from './slice';

type SceneCoords = { x: number; y: number };

const PAGE_LIMIT = 100;

/**
 * Where a deployed scene sits, as the analytics API keys it.
 *
 * `scene.base` is the authoritative base parcel; the lowest parcel is the
 * fallback for a deployment whose metadata is missing it, so a scene is never
 * dropped for want of a coordinate. Compared as coordinates rather than as
 * strings — `"10,0"` sorts before `"9,0"` — because two scenes resolving to the
 * same base collide downstream.
 */
function sceneBase(scene: WorldScene): SceneCoords | null {
  const base = scene.entity?.metadata?.scene?.base;
  if (base) return parseCoords(base);

  const parcels = (scene.parcels ?? []).map(parseCoords).filter(coords => coords !== null);
  return parcels.sort((a, b) => a.x - b.x || a.y - b.y)[0] ?? null;
}

/**
 * Walks an offset-paged endpoint until `total` is covered, retrying a page that
 * fails and giving up as `null` once it keeps failing.
 *
 * These endpoints answer `null` rather than throwing, so a page that never
 * arrives has to be told apart from one that is genuinely empty.
 */
async function readAllPages<T>(
  page: (offset: number) => Promise<{ items: T[]; total: number } | null>,
): Promise<T[] | null> {
  const items: T[] = [];
  let total = Infinity;

  while (items.length < total) {
    const result = await retry(async () => {
      const answer = await page(items.length);
      if (!answer) throw new Error(`No answer for the page at offset ${items.length}`);
      return answer;
    }).catch(error => {
      console.warn('[paged-read] gave up on a page after retries', error);
      return null;
    });

    if (!result) return null;
    if (result.items.length === 0) break;

    items.push(...result.items);
    total = result.total;
  }

  return items;
}

/**
 * Base coordinates of every scene deployed in a world, for analytics lookups.
 *
 * `null` means the lookup failed, which is a different answer from `[]`: a world
 * whose scenes cannot be listed contributes no analytics rows, and reading that
 * as "no scenes" is how a transient failure turns into a silently shorter list.
 */
export async function fetchWorldSceneCoords(
  worldsApi: Worlds,
  worldName: string,
): Promise<SceneCoords[] | null> {
  try {
    const scenes = await readAllPages(async offset => {
      const response = await worldsApi.fetchWorldScenes(worldName, {
        limit: PAGE_LIMIT,
        offset,
      });
      return response && { items: response.scenes, total: response.total };
    });

    return scenes?.map(sceneBase).filter(coords => coords !== null) ?? null;
  } catch {
    return null;
  }
}

/**
 * A world as the app models it, with the coordinates of everything deployed in it.
 *
 * `scenes` is left undefined when the lookup failed, keeping "we could not ask"
 * distinguishable from "there are none".
 */
export async function toManagedProject(
  worldsApi: Worlds,
  world: WorldData,
  address: string,
): Promise<ManagedProject> {
  const hasEverBeenDeployed = Boolean(world.owner);

  return {
    id: world.name,
    displayName: world.name,
    type: ManagedProjectType.WORLD,
    role:
      world.owner?.toLowerCase() === address.toLowerCase()
        ? WorldRoleType.OWNER
        : WorldRoleType.COLLABORATOR,
    deployment: hasEverBeenDeployed
      ? {
          title: world.title || world.name,
          description: world.description || '',
          thumbnail: world.thumbnailHash ? worldsApi.getContentSrcUrl(world.thumbnailHash) : '',
          lastPublishedAt: world.lastDeployedAt ? new Date(world.lastDeployedAt).getTime() : 0,
          scenesCount: world.deployedScenes || 0,
        }
      : undefined,
    scenes: world.deployedScenes
      ? ((await fetchWorldSceneCoords(worldsApi, world.name)) ?? undefined)
      : [],
  };
}

/**
 * Every world the wallet has deployed to, whoever is asking and whatever the
 * Manage page is currently showing.
 *
 * The Manage page's own list is narrowed by its search box, sort and page, so
 * anything that needs the whole set has to ask for it separately.
 *
 * Throws rather than answering short: a world whose scenes could not be listed
 * contributes none, which reads downstream as a creator who owns fewer than
 * they do.
 */
export async function fetchAllDeployedWorlds(
  worldsApi: Worlds,
  address: string,
): Promise<ManagedProject[]> {
  const worlds = await readAllPages(async offset => {
    const response = await worldsApi.fetchWorlds({
      has_deployed_scenes: true,
      authorized_deployer: address,
      limit: PAGE_LIMIT,
      offset,
    });
    return response && { items: response.worlds, total: response.total };
  });

  if (!worlds) throw new Error('Failed to fetch worlds');

  const projects = await Promise.all(
    worlds.map(world => toManagedProject(worldsApi, world, address)),
  );

  const unreadable = projects
    .filter(project => project.scenes === undefined)
    .map(project => project.id);
  if (unreadable.length > 0) {
    throw new Error(`Failed to list the scenes deployed in ${unreadable.join(', ')}`);
  }

  return projects;
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
