import { LandType, type Land } from '/@/lib/land';

export type Coord = { x: number; y: number };
export type CollaboratorScope =
  | { kind: 'token' }
  | { kind: 'estate-wide' }
  | { kind: 'parcels'; parcels: Coord[] };
export type Collaborator = { address: string; scope: CollaboratorScope };

/** The LAND's update operators: the token's own one, and for an estate, each parcel operator. */
export function getCollaborators(land: Land): Collaborator[] {
  if (land.type === LandType.PARCEL) {
    return land.updateOperator ? [{ address: land.updateOperator, scope: { kind: 'token' } }] : [];
  }
  const byOperator = new Map<string, Coord[]>();
  for (const { x, y, updateOperator } of land.parcels ?? []) {
    if (updateOperator)
      byOperator.set(updateOperator, [...(byOperator.get(updateOperator) ?? []), { x, y }]);
  }
  return [
    ...(land.updateOperator
      ? [{ address: land.updateOperator, scope: { kind: 'estate-wide' } } as Collaborator]
      : []),
    ...[...byOperator].map(
      ([address, parcels]): Collaborator => ({ address, scope: { kind: 'parcels', parcels } }),
    ),
  ];
}
