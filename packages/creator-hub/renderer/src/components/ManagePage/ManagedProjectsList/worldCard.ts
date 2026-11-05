import type { ManagedProject } from '/shared/types/manage';

import type { CardPlace, PlaceCardStatus } from '../PlaceCard';
import { getRoleTag } from '../RoleTag';
import type { RoleTagVariant } from '../RoleTag';

type WorldCard = {
  name: string;
  place: CardPlace;
  role: RoleTagVariant | undefined;
  status: PlaceCardStatus;
  thumbnail: string | undefined;
  scenesCount: number;
  to: string | undefined;
};

/**
 * The `PlaceCard` props of a World: named by its World Name, else its scene's title, else its domain.
 * A stream-only World has no detail page, so its card has no link.
 */
export function toWorldCard(project: ManagedProject): WorldCard {
  const { id, title, role, deployment, access } = project;
  return {
    name: title || deployment?.title || id,
    place: { kind: 'world', domain: id },
    role: getRoleTag(role),
    status: deployment ? 'published' : 'unpublished',
    thumbnail: deployment?.thumbnail,
    scenesCount: deployment?.scenesCount ?? 0,
    to: access === 'stream' ? undefined : `/manage/world/${encodeURIComponent(id)}/details`,
  };
}
