import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

import type { TranslationPath } from '/@/modules/store/translation/types';
import { t } from '/@/modules/store/translation/utils';

import { Loader } from '../../Loader';
import { AvatarWithInfo } from '../../AvatarWithInfo';
import { TextInput } from '../../TextInput';
import {
  resolveRecipient,
  type Recipient,
  type RecipientPurpose,
  type Resolution,
} from './resolveRecipient';
import { ErrorText, Root } from './RecipientField.styled';

const RESOLVE_DELAY_MS = 400;

const PLACEHOLDER: Record<RecipientPurpose, TranslationPath> = {
  transfer: 'recipient.label',
  add: 'recipient.placeholder',
};

type Props = {
  purpose: RecipientPurpose;
  self: string;
  onResolved: (recipient: Recipient | null) => void;
  action?: ReactNode;
  autoFocus?: boolean;
};

/** "Wallet address or NAME": resolves a typed address or NAME and previews the recipient. */
export function RecipientField({ purpose, self, onResolved, action, autoFocus }: Props) {
  const [value, setValue] = useState('');
  const [resolving, setResolving] = useState(false);
  const [resolution, setResolution] = useState<Resolution>({ kind: 'empty' });
  const request = useRef(0);
  const errorId = useId();

  useEffect(() => {
    const current = ++request.current;
    onResolved(null);
    if (!value.trim()) {
      setResolution({ kind: 'empty' });
      return;
    }
    setResolving(true);
    const timer = setTimeout(async () => {
      const next = await resolveRecipient(value, self, purpose).catch(
        (): Resolution => ({ kind: 'error', error: 'recipient.errors.not_found' }),
      );
      if (current !== request.current) return;
      setResolving(false);
      setResolution(next);
      onResolved(next.kind === 'resolved' ? next.recipient : null);
    }, RESOLVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [value]);

  const error = resolution.kind === 'error' ? resolution.error : undefined;

  return (
    <Root>
      <TextInput
        value={value}
        placeholder={t(PLACEHOLDER[purpose])}
        autoFocus={autoFocus}
        error={!!error}
        onChange={event => setValue(event.target.value)}
        inputProps={{
          'aria-label': t('recipient.label'),
          'aria-invalid': !!error,
          'aria-describedby': error ? errorId : undefined,
          spellCheck: false,
        }}
        endAdornment={
          <>
            {resolving && <Loader size={16} />}
            {action}
          </>
        }
      />
      {error && <ErrorText id={errorId}>{t(error)}</ErrorText>}
      <div role="status">
        {resolution.kind === 'resolved' && <AvatarWithInfo value={resolution.recipient.address} />}
      </div>
    </Root>
  );
}
