import { useCallback, useEffect, useId, useRef, useState } from 'react';

import welcomeImage from '/assets/images/earn/welcome.webp';

import type { WalletReason } from '/shared/types/creator-fund';

import { useDispatch } from '#store';
import { actions } from '/@/modules/store/creatorFund';
import type { TranslationPath } from '/@/modules/store/translation/types';
import { t } from '/@/modules/store/translation/utils';

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
import { CheckingBody, ReasonLine, ResultBody, WelcomeImage } from './JoinFlow.styled';
import { Spinner } from './Spinner';
import { TermsModal } from './TermsModal';
import { CloseIcon } from './icons';

export type JoinOutcome = 'cancelled' | 'failed' | 'joined' | 'conflict';

type Step =
  | { name: 'checking' }
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

/**
 * The join flow: eligibility check, terms, contact info, welcome.
 * @param props.onExit - called once, with how the flow ended.
 */
export function JoinFlow({ onExit }: { onExit: (outcome: JoinOutcome) => void }) {
  const dispatch = useDispatch();
  const titleId = useId();
  const [step, setStep] = useState<Step>({ name: 'checking' });
  const [submission, setSubmission] = useState<Submission>({});
  const onExitRef = useRef(onExit);
  onExitRef.current = onExit;
  const checkRef = useRef<{ abort: () => void } | null>(null);

  useEffect(() => {
    const check = dispatch(actions.fetchEligibility());
    checkRef.current = check;
    check
      .unwrap()
      .then(result =>
        setStep(
          result.eligible ? { name: 'terms' } : { name: 'ineligible', reasons: result.reasons },
        ),
      )
      .catch(error => {
        if (error?.name !== 'AbortError') onExitRef.current('failed');
      });
    return () => check.abort();
  }, [dispatch]);

  const cancel = useCallback(() => {
    checkRef.current?.abort();
    onExit('cancelled');
  }, [onExit]);

  const finish = useCallback(() => onExit('joined'), [onExit]);

  const submit = useCallback(
    async (values: ContactValues) => {
      if (step.name !== 'contact') return;
      setSubmission({ status: 'submitting' });
      const result = await dispatch(
        actions.saveEnrollment({ terms_version: step.termsVersion, ...values }),
      );
      if (actions.saveEnrollment.fulfilled.match(result)) {
        setStep({ name: 'welcome' });
        return;
      }
      const failure = result.payload;
      if (failure?.status === 403) {
        setStep({ name: 'ineligible', reasons: failure.body?.reasons ?? [] });
        return;
      }
      if (failure?.status === 409) {
        onExit('conflict');
        return;
      }
      if (failure?.status === 400) {
        const latest = await dispatch(actions.fetchTerms());
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
    [dispatch, step, onExit],
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
              <Spinner
                size={80}
                label={t('earn.checking.progress_label')}
              />
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
