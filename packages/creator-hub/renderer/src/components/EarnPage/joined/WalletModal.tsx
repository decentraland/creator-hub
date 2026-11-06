import { useEffect, useId, useRef, useState } from 'react';

import { analytics } from '#preload';
import { useDispatch } from '#store';
import { actions } from '/@/modules/store/creatorFund';
import type { TranslationPath } from '/@/modules/store/translation/types';
import { t } from '/@/modules/store/translation/utils';

import { EarnDialog } from '../EarnDialog';
import { ModalCta, ModalTitle } from '../EarnModal.styled';
import { WarningIcon } from '../icons';

import {
  Body,
  Callout,
  FailureLine,
  Field,
  FieldError,
  FieldInput,
  FieldLabel,
  ModalForm,
  ModalIntro,
  PayoutActions,
} from './PayoutModals.styled';
import { isWalletAddress } from './wallet';

export type WalletModalVariant = 'add' | 'change';

const COPY: Record<
  WalletModalVariant,
  { title: TranslationPath; body: TranslationPath; submit: TranslationPath; done: TranslationPath }
> = {
  add: {
    title: 'earn.joined.payouts.add.title',
    body: 'earn.joined.payouts.add.body',
    submit: 'earn.joined.payouts.add.submit',
    done: 'earn.joined.payouts.snackbar.wallet_added',
  },
  change: {
    title: 'earn.joined.payouts.change.title',
    body: 'earn.joined.payouts.change.body',
    submit: 'earn.joined.payouts.change.submit',
    done: 'earn.joined.payouts.snackbar.wallet_updated',
  },
};

type Submission = 'idle' | 'saving' | 'refused' | 'failed';

/** The wallet address field, focused once it mounts inside the dialog; its error line is live. */
function WalletField({
  value,
  invalid,
  inputRef,
  onChange,
  onBlur,
}: {
  value: string;
  invalid: boolean;
  inputRef: React.RefObject<HTMLInputElement>;
  onChange: (value: string) => void;
  onBlur: () => void;
}) {
  const id = useId();
  const errorId = `${id}-error`;

  useEffect(() => inputRef.current?.focus(), []);

  return (
    <Field>
      <FieldLabel htmlFor={id}>{t('earn.joined.payouts.wallet_field.label')}</FieldLabel>
      <FieldInput
        id={id}
        inputRef={inputRef}
        value={value}
        placeholder={t('earn.joined.payouts.wallet_field.placeholder')}
        autoComplete="off"
        error={invalid}
        data-filled={value ? 'true' : undefined}
        onChange={event => onChange(event.target.value.trim())}
        onBlur={onBlur}
        inputProps={{
          spellCheck: false,
          'aria-invalid': invalid || undefined,
          'aria-describedby': invalid ? errorId : undefined,
        }}
      />
      <FieldError
        id={errorId}
        aria-live="polite"
      >
        {invalid && (
          <>
            <WarningIcon />
            {t('earn.joined.payouts.wallet_field.invalid')}
          </>
        )}
      </FieldError>
    </Field>
  );
}

/**
 * Adds or changes the payout wallet.
 * @param props.onDone - called with the snackbar message once the wallet is saved.
 */
export function WalletModal({
  variant,
  onClose,
  onDone,
}: {
  variant: WalletModalVariant;
  onClose: () => void;
  onDone: (message: TranslationPath) => void;
}) {
  const dispatch = useDispatch();
  const titleId = useId();
  const copy = COPY[variant];
  const [address, setAddress] = useState('');
  const [blurred, setBlurred] = useState(false);
  const [submission, setSubmission] = useState<Submission>('idle');
  const fieldRef = useRef<HTMLInputElement>(null);
  const valid = isWalletAddress(address);
  const invalid = (blurred && !!address && !valid) || submission === 'refused';

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!valid || submission === 'saving') return;
    setSubmission('saving');
    const result = await dispatch(actions.savePayoutWallet({ address }));
    void analytics.track('Creator Fund Payout Wallet Saved', {
      action: variant === 'add' ? 'add' : 'edit',
      ok: actions.savePayoutWallet.fulfilled.match(result),
    });
    if (actions.savePayoutWallet.fulfilled.match(result)) {
      onDone(copy.done);
      return;
    }
    if (result.payload?.status === 400) {
      setSubmission('refused');
      fieldRef.current?.focus();
      return;
    }
    setSubmission('failed');
  };

  return (
    <EarnDialog
      labelledBy={titleId}
      onClose={onClose}
    >
      <ModalForm
        noValidate
        onSubmit={submit}
      >
        <ModalIntro>
          <ModalTitle id={titleId}>{t(copy.title)}</ModalTitle>
          <Body>{t(copy.body)}</Body>
        </ModalIntro>
        <WalletField
          value={address}
          invalid={invalid}
          inputRef={fieldRef}
          onChange={value => {
            setAddress(value);
            if (submission === 'refused') setSubmission('idle');
          }}
          onBlur={() => setBlurred(true)}
        />
        <Callout role="note">
          <WarningIcon />
          {t('earn.joined.payouts.erc20')}
        </Callout>
        {submission === 'failed' && (
          <FailureLine role="alert">{t('earn.errors.generic')}</FailureLine>
        )}
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
            disabled={!valid || submission === 'saving'}
            aria-busy={submission === 'saving' || undefined}
          >
            {t(copy.submit)}
          </ModalCta>
        </PayoutActions>
      </ModalForm>
    </EarnDialog>
  );
}
