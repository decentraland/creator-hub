import type { ManagedProject } from '/shared/types/manage';
import { ManagedProjectType } from '/shared/types/manage';

import type { MetricLocation } from '/@/lib/metricsApi';

/**
 * How the POC names a place to the fund: `world:<name>` or `land:<x,y>`.
 *
 * The eligibility service keys places by Places API id, which Creator Hub does
 * not hold for a World or a parcel. Opt-in rules (private World, excluded
 * content) are World-wide, so every scene of a World shares the World's key.
 */
export type FundPlaceKey = `world:${string}` | `land:${string}`;

export const worldFundKey = (worldName: string): FundPlaceKey => `world:${worldName.toLowerCase()}`;

export function fundKeyOfLocation(location: MetricLocation): FundPlaceKey {
  return location.world ? worldFundKey(location.world) : `land:${location.x},${location.y}`;
}

/** A Manage page tile: a World by its name, a LAND by its id. */
export function fundKeyOfProject(project: ManagedProject): FundPlaceKey {
  return project.type === ManagedProjectType.WORLD
    ? worldFundKey(project.id)
    : `land:${project.id}`;
}

export function parseFundPlaceKey(key: FundPlaceKey): { world: string | null; position: string } {
  const separator = key.indexOf(':');
  const rest = key.slice(separator + 1);
  return key.startsWith('world:')
    ? { world: rest, position: '0,0' }
    : { world: null, position: rest };
}
