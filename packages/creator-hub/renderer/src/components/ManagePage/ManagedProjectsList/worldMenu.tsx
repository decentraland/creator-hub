import { analytics, misc } from '#preload';
import { WorldRoleType } from '/@/lib/worlds';
import { t } from '/@/modules/store/translation/utils';
import { CREATE_EVENT_URL, getJumpInUrl } from '/@/modules/utils';
import type { ManagedProject } from '/shared/types/manage';

import type { Option } from '../../Dropdown';
import {
  CalendarGlyph,
  JumpInGlyph,
  LinkGlyph,
  StorageGlyph,
  UnpublishGlyph,
} from '../cardMenuGlyphs.styled';
import { getStorageUrl } from './utils';

type Actions = {
  onUnpublishWorld: () => void;
  onUrlCopied: () => void;
};

/**
 * The ⋮ items of a World card (Figma `5738:7459`): the World links, Create Event, then View Storage
 * and Unpublish.
 */
export function getWorldMenuOptions(project: ManagedProject, actions: Actions): Option[] {
  const { id, type, role, deployment, access } = project;
  const isOwner = role === WorldRoleType.OWNER;
  const url = getJumpInUrl(id);

  const links: Option[] = deployment
    ? [
        {
          text: t('manage.cards.menu.jump_in'),
          icon: <JumpInGlyph />,
          handler: () => {
            analytics.track('Manage Worlds External Action', { action: 'Jump into World' });
            void misc.openExternal(url);
          },
        },
        {
          text: t('manage.cards.menu.copy_url'),
          icon: <LinkGlyph />,
          handler: () => {
            void misc.copyToClipboard(url);
            actions.onUrlCopied();
          },
        },
      ]
    : [];

  const afterDivider: Option[] = [];
  if (deployment && access !== 'stream') {
    afterDivider.push({
      text: t('manage.cards.menu.view_storage'),
      icon: <StorageGlyph />,
      handler: () => {
        analytics.track('Manage Worlds External Action', { action: 'View Storage' });
        void misc.openExternal(getStorageUrl(type, id));
      },
    });
  }
  if (isOwner && deployment?.scenesCount) {
    afterDivider.push({
      text: t('manage.cards.menu.unpublish'),
      icon: <UnpublishGlyph />,
      tone: 'danger',
      handler: actions.onUnpublishWorld,
    });
  }
  return [
    ...links,
    {
      text: t('manage.cards.menu.create_event'),
      icon: <CalendarGlyph />,
      handler: () => misc.openExternal(CREATE_EVENT_URL),
      divider: afterDivider.length > 0,
    },
    ...afterDivider,
  ];
}
