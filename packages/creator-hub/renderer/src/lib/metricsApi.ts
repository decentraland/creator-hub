import { localStorageGetIdentity } from '@dcl/single-sign-on-client';
import { signedHeaderFactory } from 'decentraland-crypto-fetch';

import { buildMetricsUrl } from '/shared/urls';
import { chunk } from '/shared/utils';

import { metrics } from '#preload';
import { config } from '/@/config';

import { AuthServerProvider } from './auth';

const METRICS_API_URL = config.get('METRICS_API_URL');

/** The service answers a 400 above this many locations. */
export const MAX_LOCATIONS_PER_REQUEST = 100;

const PATH = '/metrics';

const signedHeaders = signedHeaderFactory();

/** A world scene (`world` set) or a Genesis City scene. Coordinates are required for both. */
export type MetricLocation = {
  /** A valid ENS name — both `foo.dcl.eth` and plain `foo.eth` are real. */
  world?: string;
  x: number;
  y: number;
};

/** One row of the metrics bag: a value for a metric, optionally per series and period. */
export type MetricRow = {
  /** `null` for the five metrics that have a single series. */
  series: string | null;
  /** Week-start Monday (`2026-06-15`) for the `*_weekly` metrics; `null` for `_30d`/`_60d`. */
  period: string | null;
  value: number;
};

export type LocationMetrics = MetricLocation & {
  /** The service's own key, for its logs. Never built or parsed here — see `readPositionally`. */
  location_key: string;
  /** Enrichment, populated for roughly a third of locations. Not a key. */
  builder_project_id: string | null;
  /**
   * Empty means either "you may not read this" or "no rows in today's export",
   * deliberately indistinguishable. Renders as "no data yet", never as an error.
   */
  metrics: Record<string, MetricRow[]>;
};

export type MetricsBatch = {
  /** The warehouse's export stamp, not our load time. Present even when every location is empty. */
  exported_at: string;
  source: string;
  locations: LocationMetrics[];
};

/**
 * ADR-44 signed-fetch headers for the request the main process will make.
 *
 * The signed payload is `post:<pathname>:<timestamp>:<metadata>` — the body is
 * not part of it, so the pathname is signed bare, with no query string and no
 * body hash. It comes from the same helper main uses to resolve the URL, because
 * a mismatch reads as a 401 with no clue why. Signing happens here because the
 * identity lives in the renderer's storage; only the headers cross to main.
 */
function buildSignedHeaders(): Record<string, string> {
  const address = AuthServerProvider.getAccount();
  if (!address) throw new Error('No connected account found');

  const identity = localStorageGetIdentity(address);
  if (!identity) throw new Error('No identity found');

  const { pathname } = buildMetricsUrl(METRICS_API_URL, PATH);
  return Object.fromEntries(signedHeaders(identity, 'post', pathname, {}).entries());
}

/**
 * Pairs each answered entry with the location that position asked for.
 *
 * The response is parallel to the request, duplicates included, and
 * `location_key` is for the service's logs — matching on it would be ambiguous
 * the moment the same location is requested twice. So identity comes from what
 * we sent, and only the metrics come from what came back.
 */
function readPositionally(
  requested: MetricLocation[],
  answered: LocationMetrics[],
): LocationMetrics[] {
  if (answered.length !== requested.length) {
    throw new Error(
      `The analytics API answered ${answered.length} of ${requested.length} locations, so the response cannot be read positionally`,
    );
  }
  return requested.map((location, index) => {
    const { location_key, builder_project_id, metrics: bag } = answered[index];
    return { ...location, location_key, builder_project_id, metrics: bag };
  });
}

/**
 * Every metric the service holds for the given locations, in one batched call
 * per 100 locations.
 *
 * Requests run in the main process: Electron's renderer sends `Origin: null`,
 * which the service's CORS allow-list rejects, so a renderer-side fetch never
 * sees the response.
 */
export async function fetchMetrics(locations: MetricLocation[]): Promise<MetricsBatch> {
  const batches = await Promise.all(
    chunk(locations, MAX_LOCATIONS_PER_REQUEST).map(async group => {
      const response = await metrics.request<MetricsBatch>({
        baseUrl: METRICS_API_URL,
        path: PATH,
        headers: buildSignedHeaders(),
        body: { locations: group },
      });
      if (!response.ok) throw new Error(response.error);
      return { ...response.data, locations: readPositionally(group, response.data.locations) };
    }),
  );

  const [first] = batches;
  return {
    exported_at: first.exported_at,
    source: first.source,
    locations: batches.flatMap(batch => batch.locations),
  };
}
