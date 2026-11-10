import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CloseIcon from '@mui/icons-material/Close';

import { analytics } from '#preload';
import artwork from '/assets/images/earn/home-banner.webp';
import { useFeatureFlags } from '/@/hooks/useFeatureFlags';
import { FeatureFlag } from '/@/modules/store/featureFlags';
import { t } from '/@/modules/store/translation/utils';

import {
  Artwork,
  ArtworkSlot,
  Banner,
  BottomGlow,
  CloseButton,
  Cta,
  Description,
  Information,
  Title,
  TopGlow,
} from './CreatorFundBanner.styled';

/** Once closed, the banner stays closed on this machine. */
export const BANNER_DISMISSED_KEY = 'creator-hub:creator-fund-banner-dismissed';

function readDismissed() {
  try {
    return localStorage.getItem(BANNER_DISMISSED_KEY) === 'true';
  } catch {
    return false;
  }
}

function saveDismissed() {
  try {
    localStorage.setItem(BANNER_DISMISSED_KEY, 'true');
  } catch {
    // Storage can be unavailable; the banner still closes for this session.
  }
}

/** The Home promo for the Creator Fund, shown under the `creatorhub-creator-fund` flag. */
export function CreatorFundBanner() {
  const navigate = useNavigate();
  const { isEnabled } = useFeatureFlags();
  const [dismissed, setDismissed] = useState(readDismissed);

  const handleLearnMore = useCallback(() => {
    void analytics.track('Creator Fund Banner Clicked', undefined);
    navigate('/earn');
  }, [navigate]);

  const handleClose = useCallback(() => {
    void analytics.track('Creator Fund Banner Dismissed', undefined);
    saveDismissed();
    setDismissed(true);
  }, []);

  if (dismissed || !isEnabled(FeatureFlag.CREATOR_FUND)) return null;

  return (
    <Banner aria-labelledby="creator-fund-banner-title">
      <BottomGlow aria-hidden />
      <Information>
        <Title id="creator-fund-banner-title">{t('home.creator_fund_banner.title')}</Title>
        <Description>{t('home.creator_fund_banner.description')}</Description>
        <Cta
          variant="contained"
          color="primary"
          disableRipple
          onClick={handleLearnMore}
        >
          {t('home.creator_fund_banner.cta')}
        </Cta>
      </Information>
      <ArtworkSlot aria-hidden>
        <TopGlow />
        <Artwork
          src={artwork}
          alt=""
        />
      </ArtworkSlot>
      <CloseButton
        type="button"
        aria-label={t('home.creator_fund_banner.close')}
        onClick={handleClose}
      >
        <CloseIcon />
      </CloseButton>
    </Banner>
  );
}
