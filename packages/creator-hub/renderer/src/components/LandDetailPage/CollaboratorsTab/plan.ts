import type { Address } from 'viem';

import type { Land } from '/@/lib/land';
import {
  buildSetEstateParcelsOperator,
  buildSetLandOperator,
  type LandTransaction,
} from '/@/lib/landTransactions';
import type { TranslationPath } from '/@/modules/store/translation/types';

import { getCollaborators, type Collaborator, type Coord } from './collaborators';

export type CollaboratorChange =
  | { kind: 'add'; address: string }
  | { kind: 'remove'; collaborators: Collaborator[] }
  | { kind: 'parcels'; address: string; parcels: Coord[]; previous: Coord[] };

type CollaboratorPlan = {
  txs: LandTransaction[];
  doneKey: TranslationPath;
  isApplied: (land: Land) => boolean;
};

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const key = ({ x, y }: Coord) => `${x},${y}`;

/** The transactions a Collaborators change needs, its done text, and how to see it applied. */
export function planCollaboratorChange(land: Land, change: CollaboratorChange): CollaboratorPlan {
  if (change.kind === 'add') {
    const replaces = getCollaborators(land).some(row => row.scope.kind !== 'parcels');
    return {
      txs: [buildSetLandOperator(land, change.address as Address)],
      doneKey: replaces ? 'tx.done.collaborator_replaced' : 'tx.done.collaborator_added',
      isApplied: next =>
        getCollaborators(next).some(
          row => row.scope.kind !== 'parcels' && same(row.address, change.address),
        ),
    };
  }

  if (change.kind === 'remove') {
    const parcels = change.collaborators.flatMap(row =>
      row.scope.kind === 'parcels' ? row.scope.parcels : [],
    );
    const whole = change.collaborators.some(row => row.scope.kind !== 'parcels');
    return {
      txs: [
        ...(whole ? [buildSetLandOperator(land, null)] : []),
        ...(parcels.length ? [buildSetEstateParcelsOperator(land.id, parcels, null)] : []),
      ],
      doneKey:
        change.collaborators.length > 1
          ? 'tx.done.collaborators_removed'
          : 'tx.done.collaborator_removed',
      isApplied: next =>
        !getCollaborators(next).some(row =>
          change.collaborators.some(removed => same(removed.address, row.address)),
        ),
    };
  }

  const chosen = new Set(change.parcels.map(key));
  const dropped = change.previous.filter(parcel => !chosen.has(key(parcel)));
  return {
    txs: [
      buildSetEstateParcelsOperator(land.id, change.parcels, change.address as Address),
      ...(dropped.length ? [buildSetEstateParcelsOperator(land.id, dropped, null)] : []),
    ],
    doneKey: 'tx.done.parcels_updated',
    isApplied: next => {
      const row = getCollaborators(next).find(
        item => item.scope.kind === 'parcels' && same(item.address, change.address),
      );
      const now = row?.scope.kind === 'parcels' ? row.scope.parcels.map(key) : [];
      return now.length === chosen.size && now.every(parcel => chosen.has(parcel));
    },
  };
}
