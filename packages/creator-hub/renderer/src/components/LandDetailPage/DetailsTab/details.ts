import { LandType, type Land } from '/@/lib/land';
import { getNameUsage } from '/@/modules/store/ens/names';
import { ENSProvider, type ENS } from '/@/modules/store/ens/types';
import type { TranslationPath } from '/@/modules/store/translation/types';

export const NAME_MAX = 50;
export const DESCRIPTION_MAX = 140;

export type FieldError = { key: TranslationPath; max?: number } | null;

/** The Details form's errors: the name is required, and each field has a character limit. */
export function validateDetails(
  name: string,
  description: string,
): { name: FieldError; description: FieldError } {
  return {
    name: !name.trim()
      ? { key: 'land_detail.details.name_required' }
      : name.length > NAME_MAX
        ? { key: 'land_detail.details.too_long', max: NAME_MAX }
        : null,
    description:
      description.length > DESCRIPTION_MAX
        ? { key: 'land_detail.details.too_long', max: DESCRIPTION_MAX }
        : null,
  };
}

type NameOption = { subdomain: string; usedBy?: string };

type DomainState =
  | { kind: 'empty' }
  | { kind: 'none'; options: NameOption[] }
  | { kind: 'set'; name: string; options: NameOption[] };

type DomainContext = {
  self: string;
  landId: string;
  landIdByParcel: Record<string, string>;
  publishedWorlds: Set<string>;
  landNameById: Record<string, string>;
};

/** Which of the account's Decentraland NAMEs can link to this LAND, and which one already does. */
export function getDomainState(names: ENS[], context: DomainContext): DomainState {
  const owned = names.filter(
    item =>
      item.provider === ENSProvider.DCL &&
      item.nftOwnerAddress?.toLowerCase() === context.self.toLowerCase(),
  );
  if (!owned.length) return { kind: 'empty' };

  let current: string | null = null;
  const options = owned.map((item): NameOption => {
    const usage = getNameUsage(
      { ...item, content: item.content ?? '' },
      context.landIdByParcel,
      context.publishedWorlds,
    );
    if (usage.landId === context.landId) current = item.subdomain;
    const usedBy = usage.world
      ? item.subdomain
      : usage.landId && usage.landId !== context.landId
        ? (context.landNameById[usage.landId] ?? usage.landId)
        : undefined;
    return usedBy ? { subdomain: item.subdomain, usedBy } : { subdomain: item.subdomain };
  });

  return current ? { kind: 'set', name: current, options } : { kind: 'none', options };
}

/** Each parcel's LAND id, an estate's parcels included, for reading which LAND a NAME jumps to. */
export function toLandIdByParcel(lands: Land[]): Record<string, string> {
  return Object.fromEntries(
    lands.flatMap(land =>
      (land.type === LandType.ESTATE ? (land.parcels ?? []) : [{ x: land.x!, y: land.y! }]).map(
        ({ x, y }) => [`${x},${y}`, land.id],
      ),
    ),
  );
}
