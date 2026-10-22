import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import GroupAddOutlinedIcon from '@mui/icons-material/GroupAddOutlined';
import ReplayIcon from '@mui/icons-material/Replay';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import TimerOutlinedIcon from '@mui/icons-material/TimerOutlined';
import { Box, Chip, IconButton, Tooltip, Typography } from 'decentraland-ui2';

import { misc } from '#preload';
import { useDispatch } from '#store';
import { useCreatorFund } from '/@/hooks/useCreatorFund';
import { useAuth } from '/@/hooks/useAuth';
import { PROGRAM } from '/@/lib/creatorFund';
import { actions } from '/@/modules/store/creatorFund';
import { t } from '/@/modules/store/translation/utils';
import { CONTACT_SUPPORT_URL } from '/@/modules/utils';

import { Button } from '../Button';
import { Container } from '../Container';
import { Loader } from '../Loader';
import { Navbar, NavbarItem } from '../Navbar';
import { SignInCard } from '../ManagePage/SignInCard';
import type { CreatorFundLocationState } from '../CreatorFund/Banner';
import { JoinModal } from '../CreatorFund/JoinModal';
import { formatCycleDate, formatWholeUsd } from '../CreatorFund/utils';

import { CycleSummary } from './CycleSummary';
import { FundPlaces } from './FundPlaces';
import { PastPayouts } from './PastPayouts';
import { PayoutWallet } from './PayoutWallet';
import { PocMenu } from './PocMenu';

import './styles.css';

const PILLARS = [
  { key: 'new_players', icon: <GroupAddOutlinedIcon /> },
  { key: 'playtime', icon: <TimerOutlinedIcon /> },
  { key: 'returners', icon: <ReplayIcon /> },
] as const;

/** Lets the wallet field finish appearing (and MUI's modal hand focus back) before focusing it. */
const FOCUS_AFTER_MODAL_MS = 300;

export function CreatorFundPage() {
  const { signIn, isSigningIn } = useAuth();
  const fund = useCreatorFund();
  const { wallet, isSignedIn, isEnrolled, isLoaded, enrollment } = fund;
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [modal, setModal] = useState<{ open: boolean; initialStep: 'intro' | 'checking' }>({
    open: false,
    initialStep: 'intro',
  });
  const walletInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!wallet) return;
    dispatch(actions.fetchCreatorPlaces({ address: wallet }));
  }, [wallet]);

  useEffect(() => {
    if (wallet && isEnrolled) dispatch(actions.fetchPayouts({ address: wallet }));
  }, [wallet, isEnrolled]);

  // Arriving from the banner opens the explainer once; the state is cleared so
  // going back and forth doesn't reopen it.
  useEffect(() => {
    const state = location.state as CreatorFundLocationState | null;
    if (!state?.explain || !isLoaded) return;
    navigate(location.pathname, { replace: true, state: null });
    if (!isEnrolled) setModal({ open: true, initialStep: 'intro' });
  }, [isLoaded, location.state]);

  const handleJoin = useCallback(() => setModal({ open: true, initialStep: 'checking' }), []);
  const handleCloseModal = useCallback(() => setModal(prev => ({ ...prev, open: false })), []);

  const handleSetUpWallet = useCallback(() => {
    handleCloseModal();
    setTimeout(() => {
      walletInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      walletInputRef.current?.focus();
    }, FOCUS_AFTER_MODAL_MS);
  }, [handleCloseModal]);

  const handleSupport = useCallback(() => {
    void misc.openExternal(CONTACT_SUPPORT_URL);
  }, []);

  return (
    <main className="CreatorFundPage">
      <Navbar active={NavbarItem.CREATOR_FUND} />
      <Container>
        <Box className="PageHeader">
          <Typography variant="h3">{t('creator_fund.title')}</Typography>
          <Chip
            size="small"
            label={t('creator_fund.beta')}
            className="BetaChip"
          />
          {enrollment && (
            <Chip
              size="small"
              icon={<CheckCircleIcon />}
              className="EnrolledChip"
              label={t('creator_fund.page.enrolled_since', {
                date: formatCycleDate(enrollment.enrolled_at),
              })}
            />
          )}
          <Box className="Spacer" />
          <PocMenu address={wallet} />
        </Box>

        <Box className="Hero">
          <Typography
            variant="body1"
            className="Lead"
          >
            {t('creator_fund.page.description')}
          </Typography>
          <Typography
            variant="body2"
            className="Rules"
          >
            {t('creator_fund.page.rules', {
              pool: formatWholeUsd(PROGRAM.poolUsd),
              minPlayers: PROGRAM.minPlayers,
              minPayout: formatWholeUsd(PROGRAM.minPayoutUsd),
            })}
          </Typography>
          <Box className="Pillars">
            {PILLARS.map(pillar => (
              <Box
                className="Pillar"
                key={pillar.key}
              >
                <Box className="PillarIcon">{pillar.icon}</Box>
                <Typography variant="subtitle1">
                  {t(`creator_fund.page.pillars.${pillar.key}.title`)}
                </Typography>
                <Typography
                  variant="body2"
                  className="Muted"
                >
                  {t(`creator_fund.page.pillars.${pillar.key}.description`)}
                </Typography>
              </Box>
            ))}
          </Box>
          {isSignedIn && isLoaded && !isEnrolled && (
            <Button
              variant="contained"
              className="JoinButton"
              onClick={handleJoin}
            >
              {t('creator_fund.page.join')}
            </Button>
          )}
        </Box>

        {!isSignedIn && !isSigningIn ? (
          <SignInCard
            title={t('creator_fund.page.sign_in.title')}
            onClickSignIn={signIn}
          />
        ) : !isLoaded ? (
          <Loader size={70} />
        ) : (
          <>
            {isEnrolled && wallet && (
              <>
                <CycleSummary address={wallet} />
                <Box className="Payouts">
                  <Box className="SectionHeader">
                    <Typography variant="h5">{t('creator_fund.payouts.title')}</Typography>
                    <Tooltip
                      title={t('creator_fund.payouts.support')}
                      placement="top"
                      arrow
                    >
                      <IconButton
                        aria-label={t('creator_fund.payouts.support')}
                        onClick={handleSupport}
                      >
                        <SupportAgentIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>
                  <PayoutWallet
                    key={fund.payoutWallet?.updated_at ?? 'none'}
                    ref={walletInputRef}
                  />
                  <Box className="History">
                    <Typography variant="subtitle1">
                      {t('creator_fund.payouts.history.title')}
                    </Typography>
                    <PastPayouts
                      payouts={fund.payouts}
                      isLoading={fund.payoutsStatus === 'loading'}
                      isFailed={fund.payoutsStatus === 'failed'}
                    />
                  </Box>
                </Box>
              </>
            )}
            <FundPlaces
              places={fund.creatorPlaces}
              isLoading={fund.creatorPlacesStatus === 'loading'}
              isFailed={fund.creatorPlacesStatus === 'failed'}
            />
          </>
        )}
      </Container>
      <JoinModal
        open={modal.open}
        initialStep={modal.initialStep}
        onClose={handleCloseModal}
        onSetUpWallet={handleSetUpWallet}
      />
    </main>
  );
}
