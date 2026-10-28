import type { LandPlace, ManagedProject } from '/shared/types/manage';
import { FilterBy, ManagedProjectType, SortBy } from '/shared/types/manage';
import { retry } from '/shared/utils';

import type { Authorization, Land, LandDeployment } from '/@/lib/land';
import { coordsToId, LandType, ownedCoords, parseCoords } from '/@/lib/land';
import { t } from '/@/modules/store/translation/utils';
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
  return toSceneCoords(await fetchWorldSceneList(worldsApi, worldName));
}

async function fetchWorldSceneList(
  worldsApi: Worlds,
  worldName: string,
): Promise<WorldScene[] | null> {
  try {
    return await readAllPages(async offset => {
      const response = await worldsApi.fetchWorldScenes(worldName, {
        limit: PAGE_LIMIT,
        offset,
      });
      return response && { items: response.scenes, total: response.total };
    });
  } catch {
    return null;
  }
}

function toSceneCoords(scenes: WorldScene[] | null): SceneCoords[] | null {
  return scenes?.map(sceneBase).filter(coords => coords !== null) ?? null;
}

function firstSceneTitle(scenes: WorldScene[] | null): string | undefined {
  return scenes?.map(scene => scene.entity?.metadata?.display?.title).find(Boolean);
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
  const sceneList = world.deployedScenes ? await fetchWorldSceneList(worldsApi, world.name) : [];

  return {
    id: world.name,
    displayName: world.name,
    type: ManagedProjectType.WORLD,
    role:
      world.owner?.toLowerCase() === address.toLowerCase()
        ? WorldRoleType.OWNER
        : WorldRoleType.COLLABORATOR,
    owner: world.owner || undefined,
    title: world.title || undefined,
    deployment: hasEverBeenDeployed
      ? {
          title: firstSceneTitle(sceneList) || world.name,
          description: world.description || '',
          thumbnail: world.thumbnailHash ? worldsApi.getContentSrcUrl(world.thumbnailHash) : '',
          lastPublishedAt: world.lastDeployedAt ? new Date(world.lastDeployedAt).getTime() : 0,
          scenesCount: world.deployedScenes || 0,
        }
      : undefined,
    scenes: toSceneCoords(sceneList) ?? undefined,
  };
}

/**
 * A World the wallet can stream to but not publish to, as a Manage card: two requests, each allowed to fail.
 * A World whose scenes cannot be read is listed as unpublished rather than dropped.
 */
export async function toStreamOnlyProject(
  worldsApi: Worlds,
  worldName: string,
): Promise<ManagedProject> {
  const [scenes, settings] = await Promise.all([
    worldsApi.fetchWorldScenes(worldName, { limit: 1 }).catch(() => null),
    worldsApi.fetchWorldSettings(worldName).catch(() => null),
  ]);

  return {
    id: worldName,
    displayName: worldName,
    type: ManagedProjectType.WORLD,
    role: WorldRoleType.COLLABORATOR,
    access: 'stream',
    title: settings?.title || undefined,
    deployment: scenes?.total
      ? {
          title: firstSceneTitle(scenes.scenes) || worldName,
          description: settings?.description || '',
          thumbnail: settings?.thumbnailHash
            ? worldsApi.getContentSrcUrl(settings.thumbnailHash)
            : '',
          lastPublishedAt: 0,
          scenesCount: scenes.total,
        }
      : undefined,
  };
}

/** A World resolved by its NAME, for a detail page whose World the loaded Manage lists miss. */
export async function resolveWorldProject(
  worldsApi: Worlds,
  ens: { subdomain: string; nftOwnerAddress: string },
  address: string,
): Promise<ManagedProject> {
  const { access: _access, ...project } = await toStreamOnlyProject(worldsApi, ens.subdomain);
  return {
    ...project,
    role:
      ens.nftOwnerAddress.toLowerCase() === address.toLowerCase()
        ? WorldRoleType.OWNER
        : WorldRoleType.COLLABORATOR,
    owner: ens.nftOwnerAddress,
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

const parcelIds = (land: Land) => ownedCoords([land]).map(([x, y]) => coordsToId(x, y));

/** Each LAND's deployments, keyed by LAND id; a LAND with none is left out. */
export function groupLandDeployments(
  lands: Land[],
  deployments: LandDeployment[],
): Record<string, LandDeployment[]> {
  const landIdsByParcel = new Map<string, string[]>();
  for (const land of lands) {
    for (const parcel of parcelIds(land)) {
      landIdsByParcel.set(parcel, [...(landIdsByParcel.get(parcel) ?? []), land.id]);
    }
  }

  const grouped: Record<string, LandDeployment[]> = {};
  for (const deployment of deployments) {
    const landIds = new Set(deployment.pointers.flatMap(id => landIdsByParcel.get(id) ?? []));
    for (const landId of landIds) {
      grouped[landId] = [...(grouped[landId] ?? []), deployment];
    }
  }
  return grouped;
}

function landPlace(land: Land): LandPlace {
  if (land.type === LandType.PARCEL) return { kind: 'parcel', x: land.x ?? 0, y: land.y ?? 0 };
  const [x, y] = ownedCoords([land]).sort((a, b) => a[0] - b[0] || a[1] - b[1])[0] ?? [0, 0];
  return { kind: 'estate', size: land.parcels?.length ?? land.size ?? 0, base: { x, y } };
}

/** The name a LAND card shows: its on-chain name, else "Parcel x,y" or "Estate id". */
export function getLandName(project: ManagedProject): string {
  if (project.displayName) return project.displayName;
  return project.place?.kind === 'parcel'
    ? t('manage.cards.land.parcel_name', { coords: coordsToId(project.place.x, project.place.y) })
    : t('manage.cards.land.estate_name', { id: project.id });
}

/** A LAND as a managed project, summarising its most recent deployment. */
export function toLandProject(
  land: Land,
  deployments: LandDeployment[],
  getContentSrcUrl: (hash: string) => string,
): ManagedProject {
  const latest = deployments.reduce<LandDeployment | undefined>(
    (newest, deployment) =>
      !newest || deployment.timestamp > newest.timestamp ? deployment : newest,
    undefined,
  );

  return {
    id: land.id,
    displayName: land.name,
    type: ManagedProjectType.LAND,
    role: land.role,
    deployment: latest && {
      title: latest.metadata.display?.title || land.name,
      description: latest.metadata.display?.description || '',
      thumbnail: getThumbnailUrlFromDeployment(latest, getContentSrcUrl),
      lastPublishedAt: latest.timestamp,
      scenesCount: deployments.length,
    },
    scenes: deployments
      .map(deployment => parseCoords(deployment.metadata.scene?.base ?? ''))
      .filter(coords => coords !== null),
    place: landPlace(land),
  };
}

/** The Worlds list: published worlds in server order, then the empty worlds narrowed by search and sorted. */
export function selectWorldProjects(
  published: ManagedProject[],
  empty: ManagedProject[],
  filters: { sortBy: SortBy; searchQuery: string; publishFilter?: FilterBy },
  streamOnly: ManagedProject[] = [],
): ManagedProject[] {
  const query = filters.searchQuery.trim().toLowerCase();
  const byName = (a: ManagedProject, b: ManagedProject) =>
    a.displayName.localeCompare(b.displayName);
  const matchesQuery = (project: ManagedProject) =>
    project.displayName.toLowerCase().includes(query);
  const listed = new Set([...published, ...empty].map(project => project.id));
  const streams = streamOnly.filter(
    project =>
      !listed.has(project.id) &&
      matchesQuery(project) &&
      (filters.publishFilter !== FilterBy.PUBLISHED || !!project.deployment) &&
      (filters.publishFilter !== FilterBy.UNPUBLISHED || !project.deployment),
  );
  const unpublished = [
    ...empty.filter(matchesQuery),
    ...streams.filter(project => !project.deployment),
  ];
  const publishedStreams = streams.filter(project => !!project.deployment);

  return filters.sortBy === SortBy.NAME
    ? [...published, ...publishedStreams, ...unpublished].sort(byName)
    : [...published, ...publishedStreams, ...unpublished.sort(byName)];
}

/** A scene deployed on a LAND, as the Scenes tab lists it. */
export type LandScene = {
  id: string;
  title: string;
  base: string;
  parcels: string[];
  timestamp: number;
  thumbnail: string;
};

/** The LAND's deployments as Scenes-tab rows. */
export function toLandScenes(
  deployments: LandDeployment[],
  getContentSrcUrl: (hash: string) => string,
): LandScene[] {
  return deployments.map(deployment => ({
    id: deployment.id,
    title: deployment.metadata.display?.title || deployment.metadata.scene?.base || deployment.id,
    base: deployment.metadata.scene?.base ?? deployment.pointers[0] ?? '',
    parcels: deployment.metadata.scene?.parcels ?? deployment.pointers,
    timestamp: deployment.timestamp,
    thumbnail: getThumbnailUrlFromDeployment(deployment, getContentSrcUrl),
  }));
}

export type ManagerState = 'full' | 'land-only';

/** The account's UpdateManagers, one per address; `land-only` when only the LAND registry approved it. */
export function getManagers(
  authorizations: Authorization[],
): Array<{ address: string; state: ManagerState }> {
  const types = new Map<string, Set<LandType>>();
  for (const { address, type } of authorizations) {
    types.set(address, (types.get(address) ?? new Set()).add(type));
  }
  return [...types].map(([address, registries]) => ({
    address,
    state: registries.has(LandType.ESTATE) ? 'full' : 'land-only',
  }));
}

/** LAND projects narrowed by the publish filter and search (name or `x,y`), then sorted. */
export function selectLandProjects(
  projects: ManagedProject[],
  lands: Land[],
  filters: { publishFilter?: FilterBy; sortBy: SortBy; searchQuery: string },
): ManagedProject[] {
  const landsById = new Map(lands.map(land => [land.id, land]));
  const name = filters.searchQuery.trim().toLowerCase();
  const coords = name.replace(/\s/g, '');

  const matchesSearch = (project: ManagedProject) => {
    const land = landsById.get(project.id);
    return (
      getLandName(project).toLowerCase().includes(name) ||
      (!!land && parcelIds(land).some(id => id.includes(coords)))
    );
  };
  const matchesFilter = (project: ManagedProject) =>
    filters.publishFilter === undefined ||
    (filters.publishFilter === FilterBy.PUBLISHED) === !!project.deployment;

  const byName = (a: ManagedProject, b: ManagedProject) =>
    getLandName(a).localeCompare(getLandName(b));
  const byLatest = (a: ManagedProject, b: ManagedProject) =>
    (b.deployment?.lastPublishedAt ?? 0) - (a.deployment?.lastPublishedAt ?? 0);

  return projects
    .filter(project => matchesFilter(project) && matchesSearch(project))
    .sort(filters.sortBy === SortBy.NAME ? byName : byLatest);
}

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
