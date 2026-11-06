import { useCallback, useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';

import { useDispatch, useSelector } from '#store';
import { useAuth } from '/@/hooks/useAuth';
import { useFeatureFlags } from '/@/hooks/useFeatureFlags';
import { actions, selectors } from '/@/modules/store/creatorFund';
import { FeatureFlag } from '/@/modules/store/featureFlags';
import { t } from '/@/modules/store/translation/utils';

import { Navbar, NavbarItem } from '../Navbar';

import { IneligibleModal, JoinFlow, type JoinOutcome } from './JoinFlow';
import { Landing, LandingCtas, LandingLoadError, LandingStatus } from './Landing';
import { Spinner } from './Spinner';
import { TermsModal } from './TermsModal';

function EarnContent() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isSignedIn } = useAuth();
  const enrollment = useSelector(state => state.creatorFund.enrollment.data);
  const enrollmentFailed = useSelector(state => state.creatorFund.enrollment.status === 'failed');
  const needsReaccept = useSelector(selectors.needsReaccept);
  const termsVersion = useSelector(state => state.creatorFund.terms.data?.version);
  const [refusedReasons, setRefusedReasons] = useState<string[] | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [checked, setChecked] = useState(false);
  const [joining, setJoining] = useState(false);
  const [reacceptFailed, setReacceptFailed] = useState(false);
  const [reaccepting, setReaccepting] = useState(false);

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

  const handleExit = useCallback((outcome: JoinOutcome) => {
    setJoining(false);
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

  if (!isSignedIn) return null;

  if (!checked) return <Spinner label={t('earn.loading')} />;

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
    ) : null;
  }

  return (
    <>
      <Landing audience="signed_in">
        <LandingCtas
          audience="signed_in"
          onJoin={startJoin}
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
      <Navbar active={NavbarItem.EARN} />
      <EarnContent />
    </div>
  );
}
