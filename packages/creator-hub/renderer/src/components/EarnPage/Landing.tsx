import { useState } from 'react';

import heroImage from '/assets/images/earn/hero.webp';
import moneyMouth from '/assets/images/earn/money-mouth.webp';

import type { TranslationPath } from '/@/modules/store/translation/types';
import { getCurrentLocale, t } from '/@/modules/store/translation/utils';

import type { CommonProps } from '../Icons/types';

import { ErrorLine } from './EarnModal.styled';
import { AutomaticEnrolmentIcon, CalendarIcon, PlayerActivityIcon, WalletIcon } from './icons';
import {
  CtaArea,
  CtaEmoji,
  CtaRow,
  Description,
  Feature,
  FeatureBody,
  Features,
  FeatureTitle,
  Hero,
  HeroCta,
  HeroImage,
  Highlight,
  Information,
  Intro,
  StatusLine,
  Tagline,
  Title,
  TitleBlock,
  TitleDot,
} from './Landing.styled';
import { TermsModal } from './TermsModal';

const FEATURES: {
  key: string;
  Icon: (props: CommonProps) => React.ReactElement;
  title: TranslationPath;
  body: TranslationPath;
}[] = [
  {
    key: 'enrolment',
    Icon: AutomaticEnrolmentIcon,
    title: 'earn.landing.features.enrolment.title',
    body: 'earn.landing.features.enrolment.body',
  },
  {
    key: 'cycles',
    Icon: CalendarIcon,
    title: 'earn.landing.features.cycles.title',
    body: 'earn.landing.features.cycles.body',
  },
  {
    key: 'activity',
    Icon: PlayerActivityIcon,
    title: 'earn.landing.features.activity.title',
    body: 'earn.landing.features.activity.body',
  },
  {
    key: 'payout',
    Icon: WalletIcon,
    title: 'earn.landing.features.payout.title',
    body: 'earn.landing.features.payout.body',
  },
];

export type LandingAudience = 'signed_in' | 'signed_out';

const COPY: Record<LandingAudience, { tagline: TranslationPath; cta: TranslationPath }> = {
  signed_in: { tagline: 'earn.landing.tagline_signed_in', cta: 'earn.landing.join' },
  signed_out: { tagline: 'earn.landing.tagline_signed_out', cta: 'earn.landing.sign_in_to_join' },
};

/**
 * The EARN landing for a creator who hasn't joined.
 * @param props.children - the CTA area: {@link LandingCtas} or {@link LandingLoadError}.
 */
export function Landing({
  audience,
  children,
}: {
  audience: LandingAudience;
  children: React.ReactNode;
}) {
  const copy = COPY[audience];

  return (
    <Hero>
      <HeroImage
        src={heroImage}
        alt=""
        aria-hidden
        width={1425}
        height={965}
        {...{ fetchpriority: 'high' }}
      />
      <Information>
        <Intro>
          <TitleBlock>
            <Title>
              {t('earn.landing.title_prefix')}
              <TitleDot> · </TitleDot>
              {t('earn.landing.title')}
            </Title>
            <Tagline>{t(copy.tagline)}</Tagline>
          </TitleBlock>
          <Description>
            {getCurrentLocale().formatMessage(
              { id: 'earn.landing.description' },
              {
                hl: (chunks: React.ReactNode[]) => (
                  <Highlight key={String(chunks)}>{chunks}</Highlight>
                ),
              },
            )}
          </Description>
        </Intro>
        <Features>
          {FEATURES.map(({ key, Icon, title, body }) => (
            <Feature key={key}>
              <FeatureTitle>
                <Icon />
                {t(title)}
              </FeatureTitle>
              <FeatureBody>{t(body)}</FeatureBody>
            </Feature>
          ))}
        </Features>
      </Information>
      <CtaArea>{children}</CtaArea>
    </Hero>
  );
}

/**
 * The landing CTAs: join (or sign in to join) and the read-only terms.
 * @param props.onJoin - join when signed in, sign in to join when signed out.
 */
export function LandingCtas({
  audience,
  onJoin,
  error,
}: {
  audience: LandingAudience;
  onJoin: () => void;
  error?: string;
}) {
  const [readingTerms, setReadingTerms] = useState(false);
  return (
    <>
      {error && <ErrorLine role="alert">{error}</ErrorLine>}
      <CtaRow>
        <HeroCta
          variant="contained"
          color="primary"
          disableRipple
          onClick={onJoin}
        >
          <CtaEmoji
            src={moneyMouth}
            alt=""
            width={18}
            height={18}
          />
          {t(COPY[audience].cta)}
        </HeroCta>
        <HeroCta
          variant="contained"
          color="secondary"
          disableRipple
          onClick={() => setReadingTerms(true)}
        >
          {t('earn.landing.read_terms')}
        </HeroCta>
      </CtaRow>
      {readingTerms && (
        <TermsModal
          variant="read"
          onClose={() => setReadingTerms(false)}
        />
      )}
    </>
  );
}

/** Replaces the landing CTAs for a suspended enrollment, which can't rejoin here. */
export function LandingStatus() {
  return <StatusLine role="status">{t('earn.landing.status.suspended')}</StatusLine>;
}

/** Replaces the landing CTAs while the program status can't be loaded. */
export function LandingLoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <>
      <StatusLine role="alert">{t('earn.errors.load_status')}</StatusLine>
      <CtaRow>
        <HeroCta
          variant="contained"
          color="secondary"
          disableRipple
          onClick={onRetry}
        >
          {t('earn.errors.retry')}
        </HeroCta>
      </CtaRow>
    </>
  );
}
