import { useCallback, useEffect, useId, useRef, useState } from 'react';

import type { Events } from '/shared/types/analytics';

import { analytics } from '#preload';
import { useDispatch, useSelector } from '#store';
import { actions } from '/@/modules/store/creatorFund';
import type { TranslationPath } from '/@/modules/store/translation/types';
import { getCurrentLocale, t } from '/@/modules/store/translation/utils';

import { EarnDialog } from '../EarnDialog';
import { ModalCta, ModalTitle } from '../EarnModal.styled';
import { CloseIcon } from '../icons';

import { CodeInput, EMPTY_CODE } from './CodeInput';
import {
  Body,
  CodeArea,
  CodeError,
  ModalForm,
  PayoutActions,
  ResendButton,
} from './PayoutModals.styled';

const EXPIRED: TranslationPath = 'earn.joined.payouts.verify.expired';

const SEND_FAILED: TranslationPath = 'earn.errors.generic';

const ERRORS: Record<number, TranslationPath> = {
  400: 'earn.joined.payouts.verify.incorrect',
  410: EXPIRED,
};

const VERDICTS: Record<number, Events['Creator Fund Email Code Submitted']['result']> = {
  400: 'incorrect',
  410: 'expired',
  429: 'locked',
};

/** When a resend is allowed again, by the last send's answer; `null` while nothing holds it. */
function useResendAt() {
  const verification = useSelector(state => state.creatorFund.emailVerification);
  if (verification.status === 'loading') return Infinity;
  if (verification.data) return Date.parse(verification.data.resend_available_at);
  const held = verification.failure?.body?.resend_available_at;
  return held ? Date.parse(held) : null;
}

/** Holds the resend until `resendAt`, with no countdown. */
function useResendHeld(resendAt: number | null) {
  const [, wake] = useState(0);
  const held = resendAt !== null && resendAt > Date.now();
  useEffect(() => {
    if (!held || resendAt === null || !Number.isFinite(resendAt)) return;
    const timer = setTimeout(() => wake(count => count + 1), resendAt - Date.now());
    return () => clearTimeout(timer);
  }, [held, resendAt]);
  return held;
}

/**
 * Verifies the enrollment's email with a six-digit code, sent as the modal opens.
 * @param props.onDone - called with the snackbar message once the email is verified.
 */
export function VerifyEmailModal({
  email,
  onClose,
  onDone,
}: {
  email: string;
  onClose: () => void;
  onDone: (message: TranslationPath) => void;
}) {
  const dispatch = useDispatch();
  const titleId = useId();
  const errorId = useId();
  const [code, setCode] = useState<readonly string[]>(EMPTY_CODE);
  const [error, setError] = useState<TranslationPath | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [sendFailed, setSendFailed] = useState(false);
  const resendHeld = useResendHeld(useResendAt());
  const sent = useRef(false);
  const complete = code.every(Boolean);

  const send = useCallback(async () => {
    setSendFailed(false);
    const result = await dispatch(actions.sendEmailVerification());
    if (actions.sendEmailVerification.rejected.match(result) && result.payload?.status !== 429) {
      setSendFailed(true);
    }
  }, [dispatch]);

  const resend = () => {
    if (resendHeld) return;
    setError(null);
    setCode(EMPTY_CODE);
    void send();
  };

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    void send();
  }, [send]);

  const shownError = error ?? (sendFailed ? SEND_FAILED : null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!complete || verifying) return;
    setVerifying(true);
    const result = await dispatch(actions.confirmEmailVerification({ code: code.join('') }));
    setVerifying(false);
    if (actions.confirmEmailVerification.fulfilled.match(result)) {
      void analytics.track('Creator Fund Email Code Submitted', { result: 'verified' });
      onDone('earn.joined.payouts.snackbar.email_verified');
      return;
    }
    const status = result.payload?.status ?? 0;
    if (VERDICTS[status]) {
      void analytics.track('Creator Fund Email Code Submitted', { result: VERDICTS[status] });
    }
    setError(ERRORS[status] ?? 'earn.errors.generic');
  };

  return (
    <EarnDialog
      labelledBy={titleId}
      onClose={onClose}
    >
      <ModalForm
        noValidate
        data-variant="verify"
        onSubmit={submit}
      >
        <ModalTitle id={titleId}>{t('earn.joined.payouts.verify.title')}</ModalTitle>
        <Body>
          {getCurrentLocale().formatMessage(
            { id: 'earn.joined.payouts.verify.body_sent' },
            { email, b: (chunks: React.ReactNode[]) => <b key="email">{chunks}</b> },
          )}
          <br />
          {t('earn.joined.payouts.verify.body_instruction')}
        </Body>
        <CodeArea>
          <CodeInput
            value={code}
            labelledBy={titleId}
            describedBy={shownError ? errorId : undefined}
            invalid={!!error}
            onChange={next => {
              setCode(next);
              setError(null);
            }}
          />
          {shownError && (
            <CodeError
              id={errorId}
              role="alert"
            >
              <CloseIcon />
              {t(shownError)}
            </CodeError>
          )}
          {(!error || error === EXPIRED) && (
            <ResendButton
              type="button"
              aria-disabled={resendHeld || undefined}
              onClick={resend}
            >
              {t('earn.joined.payouts.verify.resend')}
            </ResendButton>
          )}
        </CodeArea>
        <PayoutActions>
          <ModalCta
            type="button"
            variant="contained"
            color="secondary"
            size="large"
            onClick={onClose}
          >
            {t('earn.joined.payouts.cancel')}
          </ModalCta>
          <ModalCta
            type="submit"
            variant="contained"
            color="primary"
            size="large"
            disabled={!complete || verifying || !!error}
            aria-busy={verifying || undefined}
          >
            {t('earn.joined.payouts.verify.submit')}
          </ModalCta>
        </PayoutActions>
      </ModalForm>
    </EarnDialog>
  );
}
