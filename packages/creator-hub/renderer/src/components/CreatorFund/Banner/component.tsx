import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import CloseIcon from '@mui/icons-material/Close';
import { Chip, IconButton, Typography } from 'decentraland-ui2';

import { useDispatch } from '#store';
import { useCreatorFund } from '/@/hooks/useCreatorFund';
import { PROGRAM } from '/@/lib/creatorFund';
import { actions } from '/@/modules/store/creatorFund';
import { t } from '/@/modules/store/translation/utils';
import InfluencePng from '/assets/images/influence.png';

import { Button } from '../../Button';
import { formatWholeUsd } from '../utils';

import './styles.css';

/** Where the banner sends the creator. `explain` opens the intro modal on arrival. */
export type CreatorFundLocationState = { explain?: boolean };

/** The Home header slot for the program — the Figma "Tutorial Banner" pattern. */
export function CreatorFundBanner() {
  const { bannerDismissed, isEnrolled } = useCreatorFund();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleOpen = useCallback(() => {
    const state: CreatorFundLocationState = { explain: !isEnrolled };
    navigate('/creator-fund', { state });
  }, [navigate, isEnrolled]);

  const handleDismiss = useCallback(() => {
    dispatch(actions.dismissBanner());
  }, [dispatch]);

  if (bannerDismissed) return null;

  return (
    <section
      className="CreatorFundBanner"
      aria-labelledby="creator-fund-banner-title"
    >
      <div className="Copy">
        <Chip
          size="small"
          label={t('creator_fund.beta')}
          className="BetaChip"
        />
        <Typography
          id="creator-fund-banner-title"
          variant="h4"
          className="Title"
        >
          {isEnrolled ? t('creator_fund.banner.enrolled_title') : t('creator_fund.banner.title')}
        </Typography>
        <Typography
          variant="body1"
          className="Description"
        >
          {isEnrolled
            ? t('creator_fund.banner.enrolled_description')
            : t('creator_fund.banner.description', {
                pool: formatWholeUsd(PROGRAM.poolUsd),
                b: (chunks: string) => <b>{chunks}</b>,
              })}
        </Typography>
        <Button
          variant="contained"
          className="Cta"
          onClick={handleOpen}
        >
          {isEnrolled ? t('creator_fund.banner.enrolled_cta') : t('creator_fund.banner.cta')}
        </Button>
      </div>
      <img
        className="Artwork"
        src={InfluencePng}
        alt=""
      />
      <IconButton
        className="Close"
        aria-label={t('creator_fund.banner.close')}
        onClick={handleDismiss}
      >
        <CloseIcon fontSize="small" />
      </IconButton>
    </section>
  );
}
