import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { GlobalStyles } from 'decentraland-ui2';

import type { Events } from '/shared/types/analytics';

import { analytics } from '#preload';
import { useDispatch, useSelector } from '#store';
import { useAuth } from '/@/hooks/useAuth';
import { useFeatureFlags } from '/@/hooks/useFeatureFlags';
import { actions, selectors } from '/@/modules/store/creatorFund';
import { FeatureFlag } from '/@/modules/store/featureFlags';
import { t } from '/@/modules/store/translation/utils';

import { Navbar, NavbarItem } from '../Navbar';

import { JoinedPage, type JoinedTab } from './JoinedPage';
import { IneligibleModal, JoinFlow, type JoinOutcome } from './JoinFlow';
import { Landing, LandingCtas, LandingLoadError, LandingStatus } from './Landing';
import { StickyNavbar } from './component.styled';
import { Spinner } from './Spinner';
import { TermsModal } from './TermsModal';

const STICKY_NAVBAR_HEIGHT = 130;

type EarnLocationState = { joinAfterSignIn?: boolean } | null;

type VisitState = Events['Creator Fund Viewed']['state'];

function useTrackVisit(state: VisitState | null) {
  const sent = useRef(false);
  useEffect(() => {
    if (!state || sent.current) return;
    sent.current = true;
    void analytics.track('Creator Fund Viewed', { state });
  }, [state]);
}

function EarnContent() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { isSignedIn, isSigningIn, signIn } = useAuth();
  const enrollment = useSelector(state => state.creatorFund.enrollment.data);
  const enrollmentStatus = useSelector(state => state.creatorFund.enrollment.status);
  const enrollmentFailed = enrollmentStatus === 'failed';
  const needsReaccept = useSelector(selectors.needsReaccept);
  const termsVersion = useSelector(state => state.creatorFund.terms.data?.version);
  const [refusedReasons, setRefusedReasons] = useState<string[] | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [checked, setChecked] = useState(false);
  const [joining, setJoining] = useState(false);
  const [reacceptFailed, setReacceptFailed] = useState(false);
  const [reaccepting, setReaccepting] = useState(false);
  const [tab, setTab] = useState<JoinedTab>('leaderboard');
  const joinAfterSignIn = (location.state as EarnLocationState)?.joinAfterSignIn === true;
  const settled = checked && (enrollmentStatus === 'succeeded' || enrollmentFailed);

  let visit: VisitState | null = null;
  if (!isSignedIn) visit = isSigningIn ? null : 'signed_out';
  else if (settled && !enrollmentFailed) {
    if (!enrollment) visit = 'not_joined';
    else visit = enrollment.status === 'active' ? 'joined' : 'suspended';
  }
  useTrackVisit(visit);

  useEffect(() => {
    if (!isSignedIn) return;
    let current = true;
    setChecked(false);
    void Promise.all([dispatch(actions.fetchEnrollment()), dispatch(actions.fetchTerms())]).then(
      () => current && setChecked(true),
    );
    return () => {
      current = false;
    };
  }, [isSignedIn, attempt, dispatch]);

  const startJoin = useCallback(() => setJoining(true), []);

  useEffect(() => {
    if (!joinAfterSignIn || isSigningIn || (isSignedIn && !settled)) return;
    navigate(location, { replace: true, state: null });
    if (isSignedIn && !enrollmentFailed && !enrollment) startJoin();
  }, [
    joinAfterSignIn,
    isSigningIn,
    isSignedIn,
    settled,
    enrollment,
    enrollmentFailed,
    navigate,
    location,
    startJoin,
  ]);

  const signInToJoin = useCallback(() => {
    void analytics.track('Creator Fund Join Clicked', { signed_in: false });
    navigate(location, { replace: true, state: { joinAfterSignIn: true } });
    void signIn();
  }, [navigate, location, signIn]);

  const handleExit = useCallback((outcome: JoinOutcome) => {
    setJoining(false);
    if (outcome === 'joined') setTab('my_places');
    if (outcome === 'conflict') setAttempt(value => value + 1);
  }, []);

  const reaccept = useCallback(
    async (acceptedVersion: number) => {
      if (!enrollment) return;
      setReacceptFailed(false);
      setReaccepting(true);
      const { first_name, last_name, email } = enrollment;
      const result = await dispatch(
        actions.saveEnrollment({ first_name, last_name, email, terms_version: acceptedVersion }),
      );
      if (actions.saveEnrollment.fulfilled.match(result)) {
        setReaccepting(false);
        setTab('my_places');
        return;
      }
      const failure = result.payload;
      if (failure?.status === 403) {
        setReaccepting(false);
        setRefusedReasons(failure.body?.reasons ?? []);
        return;
      }
      if (failure?.status === 400) {
        const latest = await dispatch(actions.fetchTerms());
        if (
          actions.fetchTerms.fulfilled.match(latest) &&
          latest.payload.version !== acceptedVersion
        ) {
          setReaccepting(false);
          return;
        }
      }
      setReaccepting(false);
      setReacceptFailed(true);
    },
    [dispatch, enrollment],
  );

  if (!isSignedIn) {
    return (
      <Landing audience="signed_out">
        <LandingCtas
          audience="signed_out"
          onJoin={signInToJoin}
        />
      </Landing>
    );
  }

  if (!settled) return <Spinner label={t('earn.loading')} />;

  if (enrollmentFailed) {
    return (
      <Landing audience="signed_in">
        <LandingLoadError onRetry={() => setAttempt(value => value + 1)} />
      </Landing>
    );
  }

  if (enrollment && enrollment.status !== 'active') {
    return (
      <Landing audience="signed_in">
        <LandingStatus />
      </Landing>
    );
  }

  if (refusedReasons) {
    return (
      <IneligibleModal
        reasons={refusedReasons}
        onClose={() => navigate('/home')}
      />
    );
  }

  if (enrollment && !joining) {
    return needsReaccept ? (
      <TermsModal
        key={termsVersion}
        variant="reaccept"
        onAccept={reaccept}
        onClose={() => navigate('/home')}
        error={reacceptFailed ? t('earn.errors.generic') : undefined}
        status={reaccepting ? 'submitting' : 'idle'}
      />
    ) : (
      <JoinedPage
        tab={tab}
        onTabChange={setTab}
      />
    );
  }

  return (
    <>
      <Landing audience="signed_in">
        <LandingCtas
          audience="signed_in"
          onJoin={() => {
            void analytics.track('Creator Fund Join Clicked', { signed_in: true });
            startJoin();
          }}
        />
      </Landing>
      {joining && <JoinFlow onExit={handleExit} />}
    </>
  );
}

/** The Creator Fund (EARN) section; redirects home while its flag is off. */
export function EarnPage() {
  const { isEnabled } = useFeatureFlags();
  if (!isEnabled(FeatureFlag.CREATOR_FUND)) {
    return (
      <Navigate
        to="/home"
        replace
      />
    );
  }
  return (
    <div className="EarnPage">
      <GlobalStyles
        styles={{
          html: {
            scrollPaddingTop: `calc(${STICKY_NAVBAR_HEIGHT}px + var(--cf-sticky-extra, 0px))`,
          },
        }}
      />
      <StickyNavbar>
        <Navbar active={NavbarItem.EARN} />
      </StickyNavbar>
      <EarnContent />
    </div>
  );
}
