import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import { isValid as isValidAddress } from 'decentraland-ui2/dist/components/AddressField/utils';
import {
  Box,
  CircularProgress,
  IconButton,
  InputAdornment,
  TextField,
  Tooltip,
  Typography,
} from 'decentraland-ui2';

import { useDispatch } from '#store';
import { useCreatorFund } from '/@/hooks/useCreatorFund';
import { actions } from '/@/modules/store/creatorFund';
import { t } from '/@/modules/store/translation/utils';

import { Button } from '../../Button';

import './styles.css';

export const PAYOUT_WALLET_INPUT_ID = 'creator-fund-payout-wallet';

/**
 * The address payouts go to, with a lock toggle at the end of the field.
 *
 * The lock is UI only: it keeps a saved address from being edited by accident.
 * Unlocking makes the field editable and focuses it; locking validates and
 * saves. With nothing saved yet the field starts unlocked.
 *
 * The draft is local and never re-synced from the store; the parent keys this
 * component on the saved record, so a save (or a demo reset) starts a fresh
 * draft from it.
 */
export const PayoutWallet = forwardRef<HTMLInputElement>(function PayoutWallet(_props, ref) {
  const { wallet, payoutWallet, payoutWalletStatus } = useCreatorFund();
  const dispatch = useDispatch();
  const [draft, setDraft] = useState(payoutWallet?.address ?? '');
  const [isLocked, setIsLocked] = useState(!!payoutWallet);
  const [showError, setShowError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  /** Set by the unlock click; the field can only take focus once it is enabled again. */
  const focusOnUnlock = useRef(false);

  useImperativeHandle(ref, () => inputRef.current as HTMLInputElement, []);

  useEffect(() => {
    if (isLocked || !focusOnUnlock.current) return;
    focusOnUnlock.current = false;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [isLocked]);

  const isSaving = payoutWalletStatus === 'loading';
  const address = draft.trim().toLowerCase();
  const isValid = isValidAddress(address);

  const handleLock = useCallback(() => {
    if (!isValid) {
      setShowError(true);
      return;
    }
    if (!wallet) return;
    if (address === payoutWallet?.address) {
      setIsLocked(true);
      return;
    }
    dispatch(actions.savePayoutWallet({ address: wallet, wallet: address }));
  }, [isValid, wallet, address, payoutWallet, dispatch]);

  const handleUnlock = useCallback(() => {
    focusOnUnlock.current = true;
    setIsLocked(false);
  }, []);

  const handleUseConnected = useCallback(() => {
    if (!wallet) return;
    setDraft(wallet.toLowerCase());
    setShowError(false);
  }, [wallet]);

  const lockLabel = isLocked
    ? t('creator_fund.payouts.wallet.unlock')
    : t('creator_fund.payouts.wallet.lock');

  return (
    <Box className="PayoutWallet">
      <Typography
        variant="subtitle1"
        component="label"
        htmlFor={PAYOUT_WALLET_INPUT_ID}
        className="Label"
      >
        {t('creator_fund.payouts.wallet.title')}
      </Typography>
      <Typography
        variant="body2"
        className="Muted"
      >
        {t('creator_fund.payouts.wallet.description')}
      </Typography>
      <TextField
        id={PAYOUT_WALLET_INPUT_ID}
        inputRef={inputRef}
        fullWidth
        value={draft}
        placeholder={t('creator_fund.payouts.wallet.placeholder')}
        disabled={isLocked || isSaving}
        error={showError && !isValid}
        onChange={e => {
          setDraft(e.target.value);
          setShowError(false);
        }}
        onBlur={() => setShowError(draft.trim().length > 0 && !isValid)}
        onKeyDown={e => {
          if (e.key === 'Enter') handleLock();
        }}
        className={isLocked ? 'Locked' : undefined}
        helperText={
          showError && !isValid
            ? t('creator_fund.payouts.wallet.invalid')
            : isLocked
              ? t('creator_fund.payouts.wallet.locked')
              : t('creator_fund.payouts.wallet.unlocked')
        }
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              {isSaving ? (
                <CircularProgress size={20} />
              ) : (
                <Tooltip
                  title={lockLabel}
                  placement="top"
                  arrow
                >
                  <IconButton
                    aria-label={lockLabel}
                    aria-pressed={isLocked}
                    className="LockButton"
                    onClick={isLocked ? handleUnlock : handleLock}
                  >
                    {isLocked ? <LockIcon /> : <LockOpenIcon />}
                  </IconButton>
                </Tooltip>
              )}
            </InputAdornment>
          ),
        }}
      />
      {!isLocked && !draft && wallet && (
        <Button
          variant="text"
          color="secondary"
          className="UseConnected"
          onClick={handleUseConnected}
        >
          {t('creator_fund.payouts.wallet.use_connected')}
        </Button>
      )}
    </Box>
  );
});
