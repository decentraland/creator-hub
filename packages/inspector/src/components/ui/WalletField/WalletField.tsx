import React, { useCallback, useMemo, useState } from 'react';
import cx from 'classnames';
import { isAddress } from '../../../lib/logic/ethereum';
import { TextField } from '../TextField';
import type { Props } from './types';

export const WalletField: React.FC<Props> = ({
  className,
  value,
  onChange,
  onBlur: externalOnBlur,
  onFocus: externalOnFocus,
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

  const handleBlur = useCallback(
    (event: React.FocusEvent<HTMLInputElement>) => {
      const { value } = event.target;
      setIsFocused(false);

      if (!value || isAddress(value)) {
        setError(undefined);

        const syntheticChangeEvent = {
          ...event,
          type: 'change',
        } as unknown as React.ChangeEvent<HTMLInputElement>;
        onChange?.(syntheticChangeEvent);
      } else {
        setError('Not a valid Ethereum address.');
      }
      externalOnBlur?.(event);
    },
    [onChange, externalOnBlur],
  );

  const formattedWallet = useMemo(() => {
    return isFocused
      ? wallet
      : isAddress(wallet)
        ? `${wallet.slice(0, 12)}...${wallet.slice(-8)}`
        : wallet;
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
      error={error}
      {...props}
      autoSelect
    />
  );
};

export default React.memo(WalletField);
