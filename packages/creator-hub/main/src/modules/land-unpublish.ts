import { net } from 'electron';
import { createContentClient, DeploymentBuilder } from 'dcl-catalyst-client';
import { AuthChain, EntityType, isInsideWorldLimits } from '@dcl/schemas';

import { Env } from '/shared/types/env';
import type { EmptySceneDeploy, EmptySceneDraft } from '/shared/types/land-unpublish';

import { getEnvOverride } from './electron';

const PEER_URLS: Record<Env, string> = {
  [Env.DEV]: 'https://peer.decentraland.zone',
  [Env.PROD]: 'https://peer.decentraland.org',
};
const EMPTY_SCENE_MAIN = 'bin/index.js';
const EMPTY_SCENE_CODE = 'exports.onStart=async function(){};exports.onUpdate=async function(){};';
const DEPLOY_TIMEOUT_MS = 30_000;
const PARCEL = /^(-?\d{1,3}),(-?\d{1,3})$/;

type Fetcher = Parameters<typeof createContentClient>[0]['fetcher'];
type NodeFormData = { getBuffer(): Buffer; getHeaders(): Record<string, string> };

const isNodeFormData = (body: unknown): body is NodeFormData =>
  typeof (body as NodeFormData | null)?.getBuffer === 'function' &&
  typeof (body as NodeFormData).getHeaders === 'function';

const toFetchInit = (init: RequestInit = {}): RequestInit =>
  isNodeFormData(init.body)
    ? {
        ...init,
        body: init.body.getBuffer(),
        headers: { ...(init.headers as Record<string, string>), ...init.body.getHeaders() },
      }
    : init;

const getPeerUrl = () => PEER_URLS[getEnvOverride() ?? (import.meta.env.DEV ? Env.DEV : Env.PROD)];

function assertParcel(parcel: unknown): asserts parcel is string {
  const match = typeof parcel === 'string' && PARCEL.exec(parcel);
  if (!match || !isInsideWorldLimits(Number(match[1]), Number(match[2]))) {
    throw new Error(`Invalid parcel: ${JSON.stringify(parcel)}`);
  }
}

function assertTimestamp(timestamp: unknown): asserts timestamp is number {
  if (!Number.isSafeInteger(timestamp) || (timestamp as number) < 0) {
    throw new Error(`Invalid timestamp: ${JSON.stringify(timestamp)}`);
  }
}

const throwingFetcher: Fetcher = {
  fetch: (async (url: string, init?: RequestInit) => {
    const response = await net.fetch(url, {
      ...toFetchInit(init),
      signal: AbortSignal.timeout(DEPLOY_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`Catalyst answered ${response.status}: ${await response.text()}`);
    }
    return response;
  }) as unknown as Fetcher['fetch'],
};

/** An empty SDK7 scene entity over one parcel at `timestamp`, marked `source.isEmpty`. */
export function buildEmptyScene(parcel: string, timestamp: number) {
  return DeploymentBuilder.buildEntity({
    type: EntityType.SCENE,
    pointers: [parcel],
    timestamp,
    files: new Map([[EMPTY_SCENE_MAIN, new TextEncoder().encode(EMPTY_SCENE_CODE)]]),
    metadata: {
      display: { title: 'Empty' },
      main: EMPTY_SCENE_MAIN,
      runtimeVersion: '7',
      scene: { base: parcel, parcels: [parcel] },
      source: { origin: 'creator-hub', projectId: 'unpublished-project', isEmpty: true },
    },
  });
}

/** Builds the empty scene for `parcel` now and returns the id the renderer must sign. */
export async function prepareEmptyScene(parcel: string): Promise<EmptySceneDraft> {
  assertParcel(parcel);
  const timestamp = Date.now();
  const { entityId } = await buildEmptyScene(parcel, timestamp);
  return { entityId, timestamp };
}

/** Rebuilds the empty scene from `parcel` and `timestamp` and deploys it with `authChain`. */
export async function deployEmptyScene({
  parcel,
  timestamp,
  authChain,
}: EmptySceneDeploy): Promise<void> {
  assertParcel(parcel);
  assertTimestamp(timestamp);
  if (!AuthChain.validate(authChain)) throw new Error('Invalid auth chain');

  const { entityId, files } = await buildEmptyScene(parcel, timestamp);
  if (authChain[authChain.length - 1]?.payload !== entityId) {
    throw new Error('The signature does not match the empty scene for this parcel');
  }

  const client = createContentClient({ url: `${getPeerUrl()}/content`, fetcher: throwingFetcher });
  await client.deploy({ entityId, files, authChain });
}
