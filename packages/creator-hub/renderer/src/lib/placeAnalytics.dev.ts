import type { AnalyticsPlace } from './analyticsLocations';
import { toLocalId } from './analyticsLocations';
import type { MetricLocation } from './metricsApi';

import FALLBACK_THUMBNAIL from '/assets/images/scene-thumbnail-fallback.png';

/**
 * Locations to ask about instead of the wallet's own, for seeing real numbers
 * against a local service without holding any of the places in its dataset.
 *
 * Flip `USE_DEV_PLACES` to true, run the service, and grant your wallet
 * `DEV_ACCESS` for these locations — without that grant every one answers with
 * empty metrics, which is by design indistinguishable from "no data yet".
 *
 * Delete this file and its import in `placeAnalytics.ts` when the real dataset
 * has scenes the team owns.
 */
const USE_DEV_PLACES = false;

/** Chosen to cover every branch the page has: full, partial, multi-scene, empty. */
const SEED: MetricLocation[] = [
  // All 17 metrics, ~2.8k visitors over 60 days.
  { world: 'cozyfarm.dcl.eth', x: 0, y: 0 },
  // One world, several scenes, with 17, 17, 17, 10 and 8 metrics respectively.
  { world: 'dafu.dcl.eth', x: 0, y: 0 },
  { world: 'dafu.dcl.eth', x: 2, y: 0 },
  { world: 'dafu.dcl.eth', x: 9, y: 9 },
  { world: 'dafu.dcl.eth', x: -2, y: 6 },
  { world: 'dafu.dcl.eth', x: -4, y: 0 },
  // A plain .eth name and its .dcl.eth namesake are different places.
  { world: 'silverbrainiac.eth', x: 0, y: 0 },
  { world: 'silverbrainiac.dcl.eth', x: 0, y: 0 },
  // Genesis City, richest first.
  { x: -3, y: -2 },
  { x: 2, y: -4 },
  { x: -101, y: 102 },
  // Two metrics only: most tiles read "no data yet", a couple do not.
  { x: 13, y: -6 },
  // Not in the dataset at all: empty metrics, the fully-empty row.
  { x: 999, y: 999 },
];

/** Built on demand: nothing here should run, or import anything, unless it is on. */
export const devPlaces = (): AnalyticsPlace[] | null =>
  USE_DEV_PLACES
    ? SEED.map(location => ({
        placeId: toLocalId(location),
        name: location.world
          ? `${location.world} (${location.x},${location.y})`
          : `${location.x},${location.y}`,
        thumbnail: FALLBACK_THUMBNAIL,
        location,
        publishedIn: location.world ?? 'Genesis City',
        lastUpdatedAt: null,
      }))
    : null;
