import type { LandScene } from '/@/modules/store/management/utils';
import { getCurrentLocale } from '/@/modules/store/translation/utils';
import { SortBy } from '/shared/types/manage';

/** The LAND's scenes narrowed by title or coordinates, then sorted. */
export function selectScenes(
  scenes: LandScene[],
  { sortBy, query }: { sortBy: SortBy; query: string },
): LandScene[] {
  const text = query.trim().toLowerCase();
  const coords = text.replace(/\s/g, '');
  return scenes
    .filter(
      scene =>
        scene.title.toLowerCase().includes(text) ||
        scene.parcels.some(parcel => parcel.includes(coords)),
    )
    .sort((a, b) =>
      sortBy === SortBy.NAME ? a.title.localeCompare(b.title) : b.timestamp - a.timestamp,
    );
}

/** A scene's deploy time as an ISO string, a medium date for the cell and a long date and time for its tooltip. */
export function formatSceneDate(timestamp: number) {
  const { locale } = getCurrentLocale();
  const date = new Date(timestamp);
  return {
    iso: date.toISOString(),
    medium: new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(date),
    long: new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeStyle: 'short' }).format(date),
  };
}
