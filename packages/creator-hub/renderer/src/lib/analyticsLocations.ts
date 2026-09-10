import type { ManagedProject } from '/shared/types/manage';
import { ManagedProjectType } from '/shared/types/manage';

import { t } from '/@/modules/store/translation/utils';

import type { Coords, Land } from './land';
import { Lands, coordsToId, parseCoords } from './land';
import type { MetricLocation } from './metricsApi';

/**
 * A scene the Analytics page can ask about: what to send the API, and what to
 * show for it.
 *
 * Analytics is keyed per scene, not per world, so one world can produce several
 * of these.
 */
export type AnalyticsPlace = {
  /** Our own id, used for routing. Deliberately not the API's `location_key`. */
  placeId: string;
  name: string;
  thumbnail: string;
  location: MetricLocation;
  /** Where it is published: the world's name, or "Genesis City". */
  publishedIn: string;
  /** Epoch milliseconds of the last deploy, from what the app already knows. */
  lastUpdatedAt: number | null;
};

const ID_SEPARATOR = '@';

/**
 * Identity for a place, ours to define.
 *
 * The API's `location_key` exists for its logs; building or parsing it here
 * would couple us to a format we are told not to read, so this is a separate
 * encoding that happens to carry the same facts.
 */
export function toLocalId({ world, x, y }: MetricLocation): string {
  const coords = coordsToId(x, y);
  return world ? `world:${world}${ID_SEPARATOR}${coords}` : `land:${coords}`;
}

export function fromLocalId(placeId: string): MetricLocation | null {
  const [kind, rest] = placeId.split(':', 2);
  if (!rest || (kind !== 'world' && kind !== 'land')) return null;

  const [name, coords] = kind === 'world' ? rest.split(ID_SEPARATOR) : [undefined, rest];
  const parsed = parseCoords(coords ?? '');
  if (!parsed) return null;

  return name ? { world: name, ...parsed } : parsed;
}

/**
 * How a row names itself.
 *
 * A world with one scene is just its name; the coordinates only earn their space
 * when the same world contributes more than one row and the name alone would be
 * ambiguous.
 */
function label(location: MetricLocation, scenesInWorld: number): string {
  const coords = coordsToId(location.x, location.y);
  if (!location.world) return t('analytics.list.genesis_city', { coords });
  return scenesInWorld > 1 ? `${location.world} (${coords})` : location.world;
}

function worldPlaces(projects: ManagedProject[], fallbackThumbnail: string): AnalyticsPlace[] {
  return projects
    .filter(project => project.type === ManagedProjectType.WORLD)
    .flatMap(project =>
      (project.scenes ?? []).map(({ x, y }) => {
        const location = { world: project.id, x, y };
        return {
          placeId: toLocalId(location),
          name: label(location, project.scenes?.length ?? 0),
          thumbnail: project.deployment?.thumbnail || fallbackThumbnail,
          location,
          publishedIn: project.id,
          lastUpdatedAt: project.deployment?.lastPublishedAt ?? null,
        };
      }),
    );
}

/** Every parcel the wallet holds, estates expanded into their parcels. */
function ownedCoords(lands: Land[]): Coords[] {
  return lands.flatMap(land =>
    land.parcels?.length
      ? land.parcels.map(({ x, y }): Coords => [x, y])
      : land.x !== undefined && land.y !== undefined
        ? [[land.x, land.y] as Coords]
        : [],
  );
}

/**
 * Genesis City scenes deployed on the wallet's parcels.
 *
 * Only parcels that actually hold a scene become locations: sending every owned
 * parcel would fill the list with rows that can never say anything, and a large
 * estate alone would exceed what one request accepts.
 */
async function landPlaces(lands: Land[], fallbackThumbnail: string): Promise<AnalyticsPlace[]> {
  const coords = ownedCoords(lands);
  if (coords.length === 0) return [];

  const scenes = await new Lands().fetchLandPublishedScenes(coords);

  return scenes.flatMap(scene => {
    const location = parseCoords(scene.metadata?.scene?.base ?? '');
    if (!location) return [];

    return [
      {
        placeId: toLocalId(location),
        name: scene.metadata?.display?.title || label(location, 1),
        thumbnail: fallbackThumbnail,
        location,
        publishedIn: t('analytics.detail.place.genesis_city'),
        // The deployment's own timestamp, in epoch milliseconds.
        lastUpdatedAt: scene.timestamp ?? null,
      },
    ];
  });
}

/**
 * Every scene the signed-in wallet owns or collaborates on.
 *
 * The analytics service enumerates nothing, so the list is assembled here from
 * the wallet's worlds and its LAND. Both are fetched for this list rather than
 * read off the Manage page, whose own list is narrowed by its search and page.
 *
 * Deduplicated by location, because that is what analytics answers by: two
 * scenes sharing a coordinate are one row, and keeping both would key them to
 * the same metrics and lose one anyway.
 */
export async function collectAnalyticsPlaces(
  projects: ManagedProject[],
  lands: Land[],
  fallbackThumbnail: string,
): Promise<AnalyticsPlace[]> {
  const genesisCity = await landPlaces(lands, fallbackThumbnail);
  const places = [...worldPlaces(projects, fallbackThumbnail), ...genesisCity];

  return [...new Map(places.map(place => [place.placeId, place])).values()];
}
