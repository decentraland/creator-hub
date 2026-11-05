import React, { useCallback, useMemo, useState } from 'react';
import cx from 'classnames';
import { formatAddress, isAddress } from '../../../lib/logic/ethereum';
import { TextField } from '../TextField';
import type { Props } from './types';

export const WalletField: React.FC<Props> = ({
  className,
  value,
  onChange,
  onBlur: externalOnBlur,
  onFocus: externalOnFocus,
  onKeyDown: externalOnKeyDown,
  ...props
}) => {
  const [wallet, setWallet] = useState<string>(value?.toString() ?? '');
  const [isFocused, setIsFocused] = useState<boolean>(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target;
    setWallet(value);
    setError(undefined);
  }, []);

  const handleFocus = useCallback(
    (event: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true);
      externalOnFocus?.(event);
    },
    [externalOnFocus],
  );

  // Blur and Enter both commit. The consumer reads `event.target.value`, so the synthetic
  // event carries the trimmed text: a pasted address often brings a trailing space.
  const commit = useCallback(
    (event: React.SyntheticEvent<HTMLInputElement>, raw: string) => {
      const value = raw.trim();
      if (value && !isAddress(value)) {
        setError('Not a valid Ethereum address.');
        return;
      }
      setError(undefined);
      const syntheticChangeEvent = {
        ...event,
        type: 'change',
        target: { value },
        currentTarget: { value },
      } as unknown as React.ChangeEvent<HTMLInputElement>;
      onChange?.(syntheticChangeEvent);
    },
    [onChange],
  );

  const handleBlur = useCallback(
    (event: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false);
      commit(event, event.target.value);
      externalOnBlur?.(event);
    },
    [commit, externalOnBlur],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') commit(event, event.currentTarget.value);
      externalOnKeyDown?.(event);
    },
    [commit, externalOnKeyDown],
  );

  const formattedWallet = useMemo(() => {
    return isFocused ? wallet : formatAddress(wallet);
  }, [wallet, isFocused]);

  return (
    <TextField
      className={cx('WalletField', className)}
      type="text"
      placeholder="0x..."
      value={formattedWallet}
      onChange={handleChange}
      onBlur={handleBlur}
      onFocus={handleFocus}
      onKeyDown={handleKeyDown}
      error={error}
      {...props}
      autoSelect
    />
  );
};

export default React.memo(WalletField);
