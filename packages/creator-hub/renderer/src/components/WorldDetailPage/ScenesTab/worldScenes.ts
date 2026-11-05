import type { WorldScene } from '/@/lib/worlds';
import type { LandScene } from '/@/modules/store/management/utils';

/** The World's scenes as Scenes-tab rows. */
export function toWorldScenes(scenes: WorldScene[]): LandScene[] {
  return scenes.map(scene => {
    const base = scene.entity?.metadata?.scene?.base || scene.parcels[0] || '';
    return {
      id: scene.entityId,
      title: scene.entity?.metadata?.display?.title || base || scene.entityId,
      base,
      parcels: scene.parcels,
      timestamp: Date.parse(scene.createdAt) || 0,
      thumbnail: scene.thumbnailUrl ?? '',
    };
  });
}

/** The rows a deploy collaborator may see: all of them, or those touching any of their parcels. */
export function scenesOnParcels(rows: LandScene[], allowed: 'all' | Set<string>): LandScene[] {
  if (allowed === 'all') return rows;
  return rows.filter(row => row.parcels.some(parcel => allowed.has(parcel)));
}

/** The bytes the World's scenes take up. */
export const usedBytes = (scenes: WorldScene[]) =>
  scenes.reduce((total, scene) => total + (Number(scene.size) || 0), 0);
