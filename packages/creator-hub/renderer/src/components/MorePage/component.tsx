import { useCallback } from 'react';
import { Typography } from 'decentraland-ui2';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import CodeIcon from '@mui/icons-material/Code';
import CategoryIcon from '@mui/icons-material/Category';
import BadgeIcon from '@mui/icons-material/Badge';
import PublicIcon from '@mui/icons-material/Public';
import MapIcon from '@mui/icons-material/Map';

import { misc } from '#preload';
import { t } from '/@/modules/store/translation/utils';
import type { TranslationPath } from '/@/modules/store/translation/types';

import './styles.css';

const BUILDER_URL = 'https://decentraland.org/builder';
const SUBMIT_EVENT_URL = 'https://decentraland.org/events/submit';

type ResourceCard = {
  titleKey: string;
  descriptionKey: string;
  url: string;
  BannerIcon: React.ComponentType<{ sx?: object; className?: string }>;
};

const RESOURCES: ResourceCard[] = [
  {
    titleKey: 'more.cards.create.submit_event.title',
    descriptionKey: 'more.cards.create.submit_event.description',
    url: SUBMIT_EVENT_URL,
    BannerIcon: EventAvailableIcon,
  },
  {
    titleKey: 'more.cards.create.legacy_web_editor.title',
    descriptionKey: 'more.cards.create.legacy_web_editor.description',
    url: `${BUILDER_URL}/scenes`,
    BannerIcon: CodeIcon,
  },
  {
    titleKey: 'more.cards.create.collections.title',
    descriptionKey: 'more.cards.create.collections.description',
    url: `${BUILDER_URL}/collections`,
    BannerIcon: CategoryIcon,
  },
  {
    titleKey: 'more.cards.manage.names.title',
    descriptionKey: 'more.cards.manage.names.description',
    url: `${BUILDER_URL}/names`,
    BannerIcon: BadgeIcon,
  },
  {
    titleKey: 'more.cards.manage.worlds.title',
    descriptionKey: 'more.cards.manage.worlds.description',
    url: `${BUILDER_URL}/worlds?tab=dcl`,
    BannerIcon: PublicIcon,
  },
  {
    titleKey: 'more.cards.manage.land.title',
    descriptionKey: 'more.cards.manage.land.description',
    url: `${BUILDER_URL}/land`,
    BannerIcon: MapIcon,
  },
];

function ResourceCardItem({ card }: { card: ResourceCard }) {
  const handleClick = useCallback(() => misc.openExternal(card.url), [card.url]);
  const Icon = card.BannerIcon;

  return (
    <div
      className="ResourceCard"
      onClick={handleClick}
    >
      <div className="ResourceCardBanner">
        <Icon className="ResourceCardBannerIcon" />
      </div>
      <div className="ResourceCardBody">
        <div className="ResourceCardText">
          <Typography
            variant="subtitle1"
            fontWeight={700}
          >
            {t(card.titleKey as TranslationPath)}
          </Typography>
          <Typography
            variant="body2"
            className="ResourceCardDesc"
          >
            {t(card.descriptionKey as TranslationPath)}
          </Typography>
        </div>
        <OpenInNewIcon
          className="ResourceCardIcon"
          fontSize="small"
        />
      </div>
    </div>
  );
}

export function MorePage() {
  return (
    <div className="MorePage">
      <div className="ResourcesHeader">
        <Typography variant="h3">{t('more.header.title')}</Typography>
      </div>

      <div className="ResourcesGrid">
        {RESOURCES.map((card, i) => (
          <ResourceCardItem
            key={i}
            card={card}
          />
        ))}
      </div>
    </div>
  );
}
