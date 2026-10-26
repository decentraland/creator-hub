import { misc } from '#preload';
import { RoleType } from '/@/lib/land';
import { t } from '/@/modules/store/translation/utils';
import { getSceneJumpInUrl, SUBMIT_EVENT_URL } from '/@/modules/utils';
import type { ManagedProject } from '/shared/types/manage';

import type { Option } from '../../Dropdown';
import { CalendarIcon, LinkIcon, SwapIcon } from '../../Icons';
import { JumpInGlyph } from './LandProjectsList.styled';

type Actions = {
  onTransfer: () => void;
  onUrlCopied: () => void;
};

function baseParcel(place: ManagedProject['place']) {
  if (!place) return { x: 0, y: 0 };
  return place.kind === 'parcel' ? place : place.base;
}

/** The ⋮ items of a LAND card: Jump In, Copy URL and Create Event for every role, Transfer for the owner. */
export function getLandMenuOptions(project: ManagedProject, actions: Actions): Option[] {
  const url = getSceneJumpInUrl(baseParcel(project.place));
  const isOwner = project.role === RoleType.OWNER;
  const options: Option[] = [
    {
      text: t('manage.cards.menu.jump_in'),
      icon: <JumpInGlyph />,
      handler: () => misc.openExternal(url),
    },
    {
      text: t('manage.cards.menu.copy_url'),
      icon: <LinkIcon />,
      handler: () => {
        void misc.copyToClipboard(url);
        actions.onUrlCopied();
      },
    },
    {
      text: t('manage.cards.menu.create_event'),
      icon: <CalendarIcon />,
      handler: () => misc.openExternal(SUBMIT_EVENT_URL),
      divider: isOwner,
    },
  ];
  if (!isOwner) return options;
  return [
    ...options,
    { text: t('manage.cards.menu.transfer'), icon: <SwapIcon />, handler: actions.onTransfer },
  ];
}
