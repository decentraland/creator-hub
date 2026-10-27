import { Authenticator } from '@dcl/crypto';
import { localStorageGetIdentity } from '@dcl/single-sign-on-client';
import { landUnpublish } from '#preload';

import type { Land } from './land';
import { RoleType, coordsToId, ownedCoords } from './land';

type SceneParcels = { base: string; parcels: string[] };

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

  const { entityId, timestamp } = await landUnpublish.prepare(parcel);
  const authChain = Authenticator.signPayload(identity, entityId);
  await landUnpublish.deploy({ parcel, timestamp, authChain });
}
