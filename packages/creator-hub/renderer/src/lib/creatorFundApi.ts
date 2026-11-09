import type {
  CreatorFundBanner,
  CreatorFundCycles,
  CreatorFundErrorBody,
  CreatorFundNews,
  CreatorFundTerms,
  Eligibility,
  Enrollment,
  EnrollmentRequest,
  Leaderboard,
  LeaderboardCycle,
  MyPlaces,
} from '/shared/types/creator-fund';

import { metrics } from '#preload';
import { config } from '/@/config';

import { buildSignedHeaders } from './metricsApi';

const CREATOR_FUND_API_URL = config.get('CREATOR_FUND_API_URL');

const ROOT = '/v3/creator-fund';

/** A success, or a failure carrying the service's error body (`reasons` on a 403). */
export type CreatorFundResponse<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: string; body?: CreatorFundErrorBody };

type Method = 'GET' | 'PUT';

async function sha256Hex(text: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

async function send<T>(
  method: Method,
  route: string,
  { signed = false, query, body }: { signed?: boolean; query?: string; body?: unknown } = {},
): Promise<CreatorFundResponse<T>> {
  const path = `${ROOT}${route}${query ? `?${query}` : ''}`;
  const rawBody = body === undefined ? undefined : JSON.stringify(body);
  let headers: Record<string, string> | undefined;
  if (signed) {
    try {
      headers = buildSignedHeaders(
        CREATOR_FUND_API_URL,
        path,
        method.toLowerCase() as 'get' | 'put',
        rawBody === undefined ? {} : { hashPayload: await sha256Hex(rawBody) },
      );
    } catch (error: any) {
      return { ok: false, status: 0, error: error.message };
    }
  }
  const response = await metrics.request<T>({
    baseUrl: CREATOR_FUND_API_URL,
    path,
    method,
    headers,
    rawBody,
  });
  return response as CreatorFundResponse<T>;
}

const cycleQuery = (cycle?: number | 'all') =>
  cycle === undefined ? undefined : new URLSearchParams({ cycle: String(cycle) }).toString();

/** `GET /v3/creator-fund/cycles` (public). */
export const getCycles = () => send<CreatorFundCycles>('GET', '/cycles');

/** `GET /v3/creator-fund/terms` (public). */
export const getTerms = () => send<CreatorFundTerms>('GET', '/terms');

/** `GET /v3/creator-fund/news` (public), newest first. */
export const getNews = () => send<CreatorFundNews>('GET', '/news');

/** `GET /v3/creator-fund/eligibility` (signed). */
export const getEligibility = () => send<Eligibility>('GET', '/eligibility', { signed: true });

/** `GET /v3/creator-fund/enrollment` (signed); a 404 means not enrolled. */
export const getEnrollment = () => send<Enrollment>('GET', '/enrollment', { signed: true });

/** `PUT /v3/creator-fund/enrollment` (signed): 201 joins, 200 re-accepts the terms. */
export const putEnrollment = (enrollment: EnrollmentRequest) =>
  send<Enrollment>('PUT', '/enrollment', { signed: true, body: enrollment });

/** `GET /v3/creator-fund/places` (signed); without a cycle the service picks one. */
export const getPlaces = (cycle?: number) =>
  send<MyPlaces>('GET', '/places', { signed: true, query: cycleQuery(cycle) });

/** `GET /v3/creator-fund/leaderboard` (public; served by the mock only in v0). */
export const getLeaderboard = (cycle: LeaderboardCycle) =>
  send<Leaderboard>('GET', '/leaderboard', { query: cycleQuery(cycle) });

/** `GET /v3/creator-fund/banner` (public; hidden in v0). `data` is `null` on its 204. */
export const getBanner = () => send<CreatorFundBanner>('GET', '/banner');
