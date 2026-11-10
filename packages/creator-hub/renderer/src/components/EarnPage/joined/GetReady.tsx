import { misc } from '#preload';
import { useSelector } from '#store';
import { selectors } from '/@/modules/store/creatorFund';
import { DISCORD_URL } from '/@/modules/utils';
import type { TranslationPath } from '/@/modules/store/translation/types';
import { getCurrentLocale, t } from '/@/modules/store/translation/utils';

import getReadyImage from '/assets/images/earn/get-ready.webp';

import type { CommonProps } from '../../Icons/types';
import { Feature, FeatureBody, Features, FeatureTitle, Intro, Title } from '../Landing.styled';
import { BuildIcon, CalendarIcon, DiscordIcon, NameIcon } from '../icons';

import {
  Area,
  Art,
  ArtBox,
  Body,
  Column,
  Floor,
  LinkLine,
  Scenery,
  StepLink,
} from './GetReady.styled';

const LINKS = {
  docs: 'https://docs.decentraland.org/creator/',
  refs: 'https://github.com/decentraland/sdk7-test-scenes',
  name: 'https://decentraland.org/marketplace/names/claim',
  discord: DISCORD_URL,
};

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <StepLink
      href={href}
      onClick={event => {
        event.preventDefault();
        void misc.openExternal(href);
      }}
    >
      {children}
      <span aria-hidden> →</span>
    </StepLink>
  );
}

type Step = {
  key: string;
  Icon: (props: CommonProps) => React.ReactElement;
  title: TranslationPath;
  body: (firstCycleStarted: boolean) => React.ReactNode;
};

const STEPS: Step[] = [
  {
    key: 'build',
    Icon: BuildIcon,
    title: 'earn.joined.get_ready.build.title',
    body: () =>
      getCurrentLocale().formatMessage(
        { id: 'earn.joined.get_ready.build.body' },
        {
          docs: (chunks: React.ReactNode[]) => (
            <ExternalLink
              key="docs"
              href={LINKS.docs}
            >
              {chunks}
            </ExternalLink>
          ),
          refs: (chunks: React.ReactNode[]) => (
            <ExternalLink
              key="refs"
              href={LINKS.refs}
            >
              {chunks}
            </ExternalLink>
          ),
        },
      ),
  },
  {
    key: 'name',
    Icon: NameIcon,
    title: 'earn.joined.get_ready.name.title',
    body: () => (
      <>
        {t('earn.joined.get_ready.name.body')}
        <LinkLine>
          <ExternalLink href={LINKS.name}>{t('earn.joined.get_ready.name.link')}</ExternalLink>
        </LinkLine>
      </>
    ),
  },
  {
    key: 'cycle',
    Icon: CalendarIcon,
    title: 'earn.joined.get_ready.cycle.title',
    body: firstCycleStarted =>
      t(
        firstCycleStarted
          ? 'earn.joined.get_ready.cycle.body_started'
          : 'earn.joined.get_ready.cycle.body',
      ),
  },
  {
    key: 'community',
    Icon: DiscordIcon,
    title: 'earn.joined.get_ready.community.title',
    body: () => (
      <>
        {t('earn.joined.get_ready.community.body')}
        <LinkLine>
          <ExternalLink href={LINKS.discord}>
            {t('earn.joined.get_ready.community.link')}
          </ExternalLink>
        </LinkLine>
      </>
    ),
  },
];

/**
 * Whether the first listed cycle has begun. The date stays the program's November 15th, but this
 * tab shows until a cycle closes, so its tense follows the backend's status.
 */
function useFirstCycleStarted() {
  const firstCycle = useSelector(selectors.getFirstCycle);
  return !!firstCycle && firstCycle.status !== 'upcoming';
}

/** The Leaderboard tab before any cycle has closed: what to do while the first one runs. */
export function GetReady() {
  const firstCycleStarted = useFirstCycleStarted();
  return (
    <Area>
      <Scenery>
        <ArtBox>
          <Floor />
          <Art
            src={getReadyImage}
            alt=""
            width={794}
            height={796}
            draggable={false}
          />
        </ArtBox>
      </Scenery>
      <Column>
        <Intro>
          <Title as="h2">{t('earn.joined.get_ready.title')}</Title>
          <Body>
            {t(
              firstCycleStarted
                ? 'earn.joined.get_ready.body_started'
                : 'earn.joined.get_ready.body',
            )}
          </Body>
        </Intro>
        <Features as="ol">
          {STEPS.map(({ key, Icon, title, body }) => (
            <Feature key={key}>
              <FeatureTitle>
                <Icon />
                {t(title)}
              </FeatureTitle>
              <FeatureBody>{body(firstCycleStarted)}</FeatureBody>
            </Feature>
          ))}
        </Features>
      </Column>
    </Area>
  );
}
