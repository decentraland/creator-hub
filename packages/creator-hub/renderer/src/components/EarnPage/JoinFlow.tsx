import { useCallback, useEffect, useId, useRef, useState } from 'react';

import welcomeImage from '/assets/images/earn/welcome.webp';

import { analytics, misc } from '#preload';

import type { WalletReason } from '/shared/types/creator-fund';

import { useDispatch } from '#store';
import { actions } from '/@/modules/store/creatorFund';
import type { TranslationPath } from '/@/modules/store/translation/types';
import { getCurrentLocale, t } from '/@/modules/store/translation/utils';

import { ContactInfoForm, type ContactInfoFormProps, type ContactValues } from './ContactInfoForm';
import {
  CloseButton,
  GlowLayer,
  ModalCta,
  ModalText,
  ModalTitle,
  StatusDialog,
  StatusGlow,
  StatusModal,
  WelcomeFrame,
  WelcomePaper,
  WelcomeRoot,
} from './EarnModal.styled';
import {
  CheckingBody,
  CtaPair,
  ReasonLine,
  ResultBody,
  SupportEmail,
  WelcomeImage,
} from './JoinFlow.styled';
import { CheckingSpinner } from './Spinner';
import { TermsModal } from './TermsModal';
import { CloseIcon } from './icons';

export type JoinOutcome = 'cancelled' | 'joined' | 'conflict';

const SUPPORT_EMAIL = 'creatorfund@decentraland.org';

type Step =
  | { name: 'checking' }
  | { name: 'check_failed' }
  | { name: 'ineligible'; reasons: string[] }
  | { name: 'terms' }
  | { name: 'contact'; termsVersion: number }
  | { name: 'welcome' };

type Submission = Pick<ContactInfoFormProps, 'errors' | 'status'>;

const REASONS: Record<WalletReason, TranslationPath> = {
  internal: 'earn.not_eligible.reasons.internal',
  suspended: 'earn.not_eligible.reasons.suspended',
  excluded: 'earn.not_eligible.reasons.excluded',
};

const reasonLines = (reasons: string[]) => [
  ...new Set(
    (reasons.length ? reasons : ['unknown']).map(reason =>
      t(REASONS[reason as WalletReason] ?? 'earn.not_eligible.reasons.unknown'),
    ),
  ),
];

function StatusShell({
  labelledBy,
  describedBy,
  role = 'dialog',
  busy,
  onDismiss,
  children,
}: {
  labelledBy: string;
  describedBy?: string;
  role?: 'dialog' | 'alertdialog';
  busy?: boolean;
  onDismiss: () => void;
  children: React.ReactNode;
}) {
  return (
    <StatusDialog
      role={role}
      aria-modal="true"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      aria-busy={busy || undefined}
      onKeyDown={event => event.key === 'Escape' && onDismiss()}
    >
      <GlowLayer aria-hidden>
        <StatusGlow />
      </GlowLayer>
      {children}
    </StatusDialog>
  );
}

function Close({ onClick }: { onClick: () => void }) {
  return (
    <CloseButton
      aria-label={t('earn.close')}
      onClick={onClick}
    >
      <CloseIcon />
    </CloseButton>
  );
}

/**
 * Why the wallet can't join, one line per reason, with GOT IT.
 * @param props.onClose - called from GOT IT and Escape.
 */
export function IneligibleModal({ reasons, onClose }: { reasons: string[]; onClose: () => void }) {
  const titleId = useId();
  const reasonId = useId();
  return (
    <StatusModal open>
      <StatusShell
        role="alertdialog"
        labelledBy={titleId}
        describedBy={reasonId}
        onDismiss={onClose}
      >
        <Close onClick={onClose} />
        <ResultBody>
          <ModalTitle id={titleId}>{t('earn.not_eligible.title')}</ModalTitle>
          <ModalText id={reasonId}>
            {reasonLines(reasons).map(line => (
              <ReasonLine key={line}>{line}</ReasonLine>
            ))}
          </ModalText>
          <ModalCta
            variant="contained"
            color="primary"
            size="large"
            autoFocus
            onClick={onClose}
          >
            {t('earn.not_eligible.got_it')}
          </ModalCta>
        </ResultBody>
      </StatusShell>
    </StatusModal>
  );
}

function CheckFailedModal({ onRetry, onClose }: { onRetry: () => void; onClose: () => void }) {
  const titleId = useId();
  const bodyId = useId();
  return (
    <StatusModal open>
      <StatusShell
        role="alertdialog"
        labelledBy={titleId}
        describedBy={bodyId}
        onDismiss={onClose}
      >
        <Close onClick={onClose} />
        <ResultBody>
          <ModalTitle id={titleId}>{t('earn.check_failed.title')}</ModalTitle>
          <ModalText id={bodyId}>
            {getCurrentLocale().formatMessage(
              { id: 'earn.check_failed.body' },
              {
                email: (
                  <SupportEmail
                    key="email"
                    href={`mailto:${SUPPORT_EMAIL}`}
                    onClick={event => {
                      event.preventDefault();
                      void analytics.track('Creator Fund Contact Support', {
                        source: 'check_failed',
                      });
                      void misc.openExternal(`mailto:${SUPPORT_EMAIL}`);
                    }}
                  >
                    {SUPPORT_EMAIL}
                  </SupportEmail>
                ),
              },
            )}
          </ModalText>
          <CtaPair>
            <ModalCta
              variant="contained"
              color="secondary"
              size="large"
              onClick={onClose}
            >
              {t('earn.close')}
            </ModalCta>
            <ModalCta
              variant="contained"
              color="primary"
              size="large"
              autoFocus
              onClick={onRetry}
            >
              {t('earn.errors.retry')}
            </ModalCta>
          </CtaPair>
        </ResultBody>
      </StatusShell>
    </StatusModal>
  );
}

/**
 * The join flow: eligibility check, terms, contact info, welcome.
 * @param props.onExit - called once, with how the flow ended.
 */
export function JoinFlow({ onExit }: { onExit: (outcome: JoinOutcome) => void }) {
  const dispatch = useDispatch();
  const titleId = useId();
  const [step, setStep] = useState<Step>({ name: 'checking' });
  const [checkAttempt, setCheckAttempt] = useState(0);
  const [submission, setSubmission] = useState<Submission>({});
  const [draft, setDraft] = useState<ContactValues>();
  const onExitRef = useRef(onExit);
  onExitRef.current = onExit;
  const checkRef = useRef<{ abort: () => void } | null>(null);
  /*
   * Set once the flow has called `onExit`. Close and Cancel stay live while the enrollment is
   * saved, and an answer that lands after them must not call `onExit` a second time.
   */
  const exitedRef = useRef(false);
  const exit = useCallback((outcome: JoinOutcome) => {
    if (exitedRef.current) return;
    exitedRef.current = true;
    onExitRef.current(outcome);
  }, []);

  useEffect(() => {
    const check = dispatch(actions.fetchEligibility());
    checkRef.current = check;
    check
      .unwrap()
      .then(result => {
        if (result.eligible) {
          void analytics.track('Creator Fund Eligibility Checked', { result: 'eligible' });
          setStep({ name: 'terms' });
          return;
        }
        void analytics.track('Creator Fund Eligibility Checked', {
          result: 'ineligible',
          reasons: result.reasons,
        });
        setStep({ name: 'ineligible', reasons: result.reasons });
      })
      .catch(error => {
        if (error?.name === 'AbortError') return;
        void analytics.track('Creator Fund Eligibility Checked', { result: 'error' });
        setStep({ name: 'check_failed' });
      });
    return () => check.abort();
  }, [dispatch, checkAttempt]);

  const retryCheck = useCallback(() => {
    setStep({ name: 'checking' });
    setCheckAttempt(value => value + 1);
  }, []);

  const cancel = useCallback(() => {
    checkRef.current?.abort();
    exit('cancelled');
  }, [exit]);

  const finish = useCallback(() => exit('joined'), [exit]);

  const submit = useCallback(
    async (values: ContactValues) => {
      if (step.name !== 'contact') return;
      setDraft(values);
      setSubmission({ status: 'submitting' });
      const result = await dispatch(
        actions.saveEnrollment({ terms_version: step.termsVersion, ...values }),
      );
      const joined = actions.saveEnrollment.fulfilled.match(result);
      void analytics.track(
        'Creator Fund Contact Submitted',
        joined ? { ok: true } : { ok: false, status: result.payload?.status },
      );
      if (joined) void analytics.track('Creator Fund Joined', { terms_version: step.termsVersion });
      if (exitedRef.current) return;
      if (joined) {
        setStep({ name: 'welcome' });
        return;
      }
      const failure = result.payload;
      if (failure?.status === 403) {
        setStep({ name: 'ineligible', reasons: failure.body?.reasons ?? [] });
        return;
      }
      if (failure?.status === 409) {
        exit('conflict');
        return;
      }
      if (failure?.status === 400) {
        const latest = await dispatch(actions.fetchTerms());
        if (exitedRef.current) return;
        if (
          actions.fetchTerms.fulfilled.match(latest) &&
          latest.payload.version !== step.termsVersion
        ) {
          setSubmission({});
          setStep({ name: 'terms' });
          return;
        }
      }
      setSubmission({ errors: [t('earn.errors.generic')] });
    },
    [dispatch, step, exit],
  );

  switch (step.name) {
    case 'checking':
      return (
        <StatusModal open>
          <StatusShell
            labelledBy={titleId}
            busy
            onDismiss={cancel}
          >
            <Close onClick={cancel} />
            <CheckingBody>
              <CheckingSpinner label={t('earn.checking.progress_label')} />
              <ModalTitle id={titleId}>{t('earn.checking.title')}</ModalTitle>
              <ModalText>
                {t('earn.checking.body_1')}
                <br />
                {t('earn.checking.body_2')}
              </ModalText>
            </CheckingBody>
          </StatusShell>
        </StatusModal>
      );
    case 'check_failed':
      return (
        <CheckFailedModal
          onRetry={retryCheck}
          onClose={cancel}
        />
      );
    case 'ineligible':
      return (
        <IneligibleModal
          reasons={step.reasons}
          onClose={cancel}
        />
      );
    case 'terms':
      return (
        <TermsModal
          variant="accept"
          onAccept={termsVersion => setStep({ name: 'contact', termsVersion })}
          onClose={cancel}
        />
      );
    case 'contact':
      return (
        <StatusModal open>
          <StatusShell
            labelledBy={titleId}
            onDismiss={cancel}
          >
            <Close onClick={cancel} />
            <ContactInfoForm
              titleId={titleId}
              initialValues={draft}
              onSubmit={submit}
              onCancel={cancel}
              {...submission}
            />
          </StatusShell>
        </StatusModal>
      );
    case 'welcome':
      return (
        <WelcomeRoot open>
          <WelcomeFrame>
            <WelcomeImage
              src={welcomeImage}
              alt=""
              aria-hidden
            />
            <WelcomePaper>
              <StatusShell
                labelledBy={titleId}
                onDismiss={finish}
              >
                <Close onClick={finish} />
                <ResultBody>
                  <ModalTitle id={titleId}>{t('earn.welcome.title')}</ModalTitle>
                  <ModalText>{t('earn.welcome.body')}</ModalText>
                  <ModalCta
                    variant="contained"
                    color="primary"
                    size="large"
                    autoFocus
                    onClick={finish}
                  >
                    {t('earn.welcome.lets_go')}
                  </ModalCta>
                </ResultBody>
              </StatusShell>
            </WelcomePaper>
          </WelcomeFrame>
        </WelcomeRoot>
      );
  }
}
