import { DeploymentBuilder, createContentClient } from 'dcl-catalyst-client';
import { Authenticator } from '@dcl/crypto';
import { EntityType } from '@dcl/schemas';
import { localStorageGetIdentity } from '@dcl/single-sign-on-client';

import { config } from '/@/config';
import { fetch } from '/shared/fetch';

import type { Land } from './land';
import { RoleType, coordsToId, ownedCoords } from './land';

const EMPTY_SCENE_MAIN = 'bin/index.js';
const EMPTY_SCENE_CODE = 'exports.onStart=async function(){};exports.onUpdate=async function(){};';
const DEPLOY_TIMEOUT_MS = 30_000;

type SceneParcels = { base: string; parcels: string[] };
type Fetcher = Parameters<typeof createContentClient>[0]['fetcher'];

const deployableParcelIds = (lands: Land[]) =>
  new Set(
    ownedCoords(lands.filter(land => land.roles.some(role => role !== RoleType.LESSOR))).map(
      ([x, y]) => coordsToId(x, y),
    ),
  );

/** Base parcel if still deployable, else another deployable scene parcel, else `null`. */
export function pickUnpublishParcel(scene: SceneParcels, lands: Land[]): string | null {
  const deployable = deployableParcelIds(lands);
  if (deployable.has(scene.base)) return scene.base;
  return scene.parcels.find(parcel => deployable.has(parcel)) ?? null;
}

/** An empty SDK7 scene entity over one parcel, marked `source.isEmpty`. */
export function buildEmptyScene(parcel: string) {
  return DeploymentBuilder.buildEntity({
    type: EntityType.SCENE,
    pointers: [parcel],
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

const throwingFetcher: Fetcher = {
  fetch: (async (url: string, init?: RequestInit) => {
    const response = await fetch(url, init, DEPLOY_TIMEOUT_MS);
    if (!response.ok) {
      throw new Error(`Catalyst answered ${response.status}: ${await response.text()}`);
    }
    return response;
  }) as unknown as Fetcher['fetch'],
};

/** Unpublishes a LAND scene by deploying an empty scene to the parcel `pickUnpublishParcel` picks. */
export async function clearLandScene(
  scene: SceneParcels,
  lands: Land[],
  address: string,
): Promise<void> {
  const identity = localStorageGetIdentity(address);
  if (!identity) throw new Error('No identity found');

  const parcel = pickUnpublishParcel(scene, lands);
  if (!parcel) throw new Error('The account can no longer deploy on any parcel of this scene');

  const { entityId, files } = await buildEmptyScene(parcel);
  const authChain = Authenticator.signPayload(identity, entityId);
  const client = createContentClient({
    url: `${config.get('PEER_URL')}/content`,
    fetcher: throwingFetcher,
  });
  await client.deploy({ entityId, files, authChain });
}
