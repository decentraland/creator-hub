import { useCallback, useEffect, useMemo, useRef, useState, type UIEvent } from 'react';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { Box, Checkbox, CircularProgress, FormControlLabel, Typography } from 'decentraland-ui2';

import { useDispatch, useSelector } from '#store';
import { useCreatorFund } from '/@/hooks/useCreatorFund';
import { PROGRAM, fundKeyOfLocation } from '/@/lib/creatorFund';
import { TERMS_SECTIONS, TERMS_TITLE, TERMS_UPDATED } from '/@/lib/creatorFund/terms';
import { actions } from '/@/modules/store/creatorFund';
import { t } from '/@/modules/store/translation/utils';

import { Button } from '../../Button';
import { Modal } from '../../Modals';
import { formatWholeUsdc } from '../utils';

import './styles.css';

export type JoinStep = 'intro' | 'checking' | 'not_eligible' | 'terms' | 'joined' | 'error';

type Props = {
  open: boolean;
  /** `intro` from the banner; `checking` from the page's own JOIN button, which already explained. */
  initialStep: 'intro' | 'checking';
  onClose: () => void;
  /** After joining, the creator's next job is the payout wallet. */
  onSetUpWallet: () => void;
};

/** Pixels of slack, so a fractional scroll position still counts as the end. */
const SCROLL_END_TOLERANCE = 8;

export function JoinModal({ open, initialStep, onClose, onSetUpWallet }: Props) {
  const { wallet, eligibility, eligibilityStatus, joinStatus, creatorPlaces } = useCreatorFund();
  const places = useSelector(state => state.creatorFund.places);
  const dispatch = useDispatch();
  const [step, setStep] = useState<JoinStep>(initialStep);
  const [hasReadTerms, setHasReadTerms] = useState(false);
  const [accepted, setAccepted] = useState(false);
  /** Which request the error step retries. */
  const [failedAction, setFailedAction] = useState<'check' | 'join'>('check');
  const termsRef = useRef<HTMLDivElement>(null);

  const checkEligibility = useCallback(() => {
    if (!wallet) return;
    setStep('checking');
    dispatch(actions.checkEligibility({ address: wallet }));
  }, [wallet, dispatch]);

  useEffect(() => {
    if (!open) return;
    dispatch(actions.resetEligibility());
    setHasReadTerms(false);
    setAccepted(false);
    if (initialStep === 'checking') checkEligibility();
    else setStep('intro');
  }, [open]);

  useEffect(() => {
    if (step !== 'checking') return;
    if (eligibilityStatus === 'succeeded' && eligibility) {
      setStep(eligibility.eligible ? 'terms' : 'not_eligible');
    } else if (eligibilityStatus === 'failed') {
      setFailedAction('check');
      setStep('error');
    }
  }, [step, eligibilityStatus, eligibility]);

  useEffect(() => {
    if (step !== 'terms') return;
    if (joinStatus === 'succeeded') setStep('joined');
    else if (joinStatus === 'failed') {
      setFailedAction('join');
      setStep('error');
    }
  }, [step, joinStatus]);

  // Terms short enough to fit need no scrolling to be read.
  useEffect(() => {
    const box = termsRef.current;
    if (step === 'terms' && box && box.scrollHeight <= box.clientHeight + SCROLL_END_TOLERANCE) {
      setHasReadTerms(true);
    }
  }, [step]);

  const handleTermsScroll = useCallback((e: UIEvent<HTMLDivElement>) => {
    const box = e.currentTarget;
    if (box.scrollTop + box.clientHeight >= box.scrollHeight - SCROLL_END_TOLERANCE) {
      setHasReadTerms(true);
    }
  }, []);

  const handleJoin = useCallback(() => {
    if (!wallet || !accepted) return;
    dispatch(actions.joinCreatorFund({ address: wallet }));
  }, [wallet, accepted, dispatch]);

  const handleRetry = useCallback(() => {
    if (failedAction === 'check') checkEligibility();
    else {
      dispatch(actions.resetEligibility());
      setStep('terms');
    }
  }, [failedAction, checkEligibility, dispatch]);

  const enrolledScenes = useMemo(
    () =>
      creatorPlaces.filter(place => places[fundKeyOfLocation(place.location)]?.opt_in.eligible)
        .length,
    [creatorPlaces, places],
  );

  const isJoining = joinStatus === 'loading';

  return (
    <Modal
      open={open}
      size={step === 'terms' ? 'medium' : 'small'}
      title={step === 'terms' ? TERMS_TITLE : t('creator_fund.title')}
      onClose={isJoining ? undefined : onClose}
      className="JoinCreatorFundModal"
      actions={
        <>
          {step === 'intro' && (
            <>
              <Button
                color="secondary"
                onClick={onClose}
              >
                {t('creator_fund.modal.intro.not_now')}
              </Button>
              <Button
                variant="contained"
                onClick={checkEligibility}
              >
                {t('creator_fund.modal.intro.join')}
              </Button>
            </>
          )}
          {step === 'not_eligible' && (
            <Button
              variant="contained"
              onClick={onClose}
            >
              {t('creator_fund.modal.not_eligible.close')}
            </Button>
          )}
          {step === 'terms' && (
            <>
              <Button
                color="secondary"
                onClick={onClose}
                disabled={isJoining}
              >
                {t('creator_fund.modal.terms.cancel')}
              </Button>
              <Button
                variant="contained"
                onClick={handleJoin}
                disabled={!accepted || isJoining}
              >
                {isJoining ? <CircularProgress size={20} /> : t('creator_fund.modal.terms.join')}
              </Button>
            </>
          )}
          {step === 'joined' && (
            <Button
              variant="contained"
              onClick={onSetUpWallet}
            >
              {t('creator_fund.modal.joined.cta')}
            </Button>
          )}
          {step === 'error' && (
            <>
              <Button
                color="secondary"
                onClick={onClose}
              >
                {t('creator_fund.modal.not_eligible.close')}
              </Button>
              <Button
                variant="contained"
                onClick={handleRetry}
              >
                {t('creator_fund.modal.error.retry')}
              </Button>
            </>
          )}
        </>
      }
    >
      <Box
        className="JoinCreatorFundModalBody"
        aria-live="polite"
      >
        {step === 'intro' && (
          <>
            <Typography
              variant="h5"
              className="Heading"
            >
              {t('creator_fund.modal.intro.subtitle')}
            </Typography>
            <ul className="Points">
              <li>
                {t('creator_fund.modal.intro.points.pool', {
                  pool: formatWholeUsdc(PROGRAM.poolUsdc),
                })}
              </li>
              <li>{t('creator_fund.modal.intro.points.metrics')}</li>
              <li>{t('creator_fund.modal.intro.points.counted')}</li>
            </ul>
          </>
        )}

        {step === 'checking' && (
          <Box
            className="Status"
            role="status"
          >
            <CircularProgress size={48} />
            <Typography variant="h6">{t('creator_fund.modal.checking.title')}</Typography>
            <Typography
              variant="body2"
              className="Muted"
            >
              {t('creator_fund.modal.checking.description')}
            </Typography>
          </Box>
        )}

        {step === 'not_eligible' && (
          <Box className="Status">
            <InfoOutlinedIcon className="StatusIcon Muted" />
            <Typography variant="h6">{t('creator_fund.modal.not_eligible.title')}</Typography>
            {eligibility?.reasons.map(reason => (
              <Typography
                key={reason}
                variant="body2"
                className="Muted"
              >
                {t(`creator_fund.modal.not_eligible.reasons.${reason}`)}
              </Typography>
            ))}
          </Box>
        )}

        {step === 'terms' && (
          <>
            <div
              ref={termsRef}
              className="Terms"
              tabIndex={0}
              role="document"
              aria-label={TERMS_TITLE}
              onScroll={handleTermsScroll}
            >
              <Typography
                variant="caption"
                className="Muted"
              >
                {TERMS_UPDATED}
              </Typography>
              {TERMS_SECTIONS.map(section => (
                <section key={section.heading}>
                  <Typography variant="subtitle1">{section.heading}</Typography>
                  {section.paragraphs.map(paragraph => (
                    <Typography
                      key={paragraph.slice(0, 32)}
                      variant="body2"
                    >
                      {paragraph}
                    </Typography>
                  ))}
                </section>
              ))}
            </div>
            <FormControlLabel
              className="Accept"
              disabled={!hasReadTerms || isJoining}
              control={
                <Checkbox
                  checked={accepted}
                  onChange={e => setAccepted(e.target.checked)}
                />
              }
              label={t('creator_fund.modal.terms.accept')}
            />
            {!hasReadTerms && (
              <Typography
                variant="caption"
                className="Muted"
              >
                {t('creator_fund.modal.terms.scroll_hint')}
              </Typography>
            )}
          </>
        )}

        {step === 'joined' && (
          <Box className="Status">
            <CheckCircleIcon className="StatusIcon Success" />
            <Typography variant="h6">{t('creator_fund.modal.joined.title')}</Typography>
            <Typography variant="body2">
              {t('creator_fund.modal.joined.places', { count: enrolledScenes })}
            </Typography>
            <Typography
              variant="body2"
              className="Muted"
            >
              {t('creator_fund.modal.joined.next')}
            </Typography>
          </Box>
        )}

        {step === 'error' && (
          <Box className="Status">
            <WarningAmberIcon className="StatusIcon Warning" />
            <Typography variant="h6">{t('creator_fund.modal.error.title')}</Typography>
            <Typography
              variant="body2"
              className="Muted"
            >
              {t('creator_fund.modal.error.description')}
            </Typography>
          </Box>
        )}
      </Box>
    </Modal>
  );
}
