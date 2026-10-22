import { forwardRef, useCallback, useState } from 'react';
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
import { CURRENT_CYCLE } from '/@/lib/creatorFund';
import { actions } from '/@/modules/store/creatorFund';
import { t } from '/@/modules/store/translation/utils';

import { Button } from '../../Button';
import { Modal } from '../../Modals';
import { formatCycleDate } from '../../CreatorFund/utils';

import './styles.css';

export const PAYOUT_WALLET_INPUT_ID = 'creator-fund-payout-wallet';

/**
 * The address a cycle's payout goes to, with a lock at the end of the field.
 *
 * The draft is local and never re-synced from the store: while locked the field
 * shows the saved address, and the parent keys this component on the saved
 * record, so a save (or a demo reset) starts a fresh draft from it.
 */
export const PayoutWallet = forwardRef<HTMLInputElement>(function PayoutWallet(_props, ref) {
  const { wallet, payoutWallet, payoutWalletStatus } = useCreatorFund();
  const dispatch = useDispatch();
  const [draft, setDraft] = useState(payoutWallet?.address ?? '');
  const [showError, setShowError] = useState(false);
  const [confirmUnlock, setConfirmUnlock] = useState(false);

  const isLocked = !!payoutWallet?.locked;
  const isSaving = payoutWalletStatus === 'loading';
  const isValid = isValidAddress(draft.trim());

  const save = useCallback(
    (address: string, locked: boolean) => {
      if (!wallet) return;
      dispatch(actions.savePayoutWallet({ address: wallet, wallet: address, locked }));
    },
    [wallet, dispatch],
  );

  const handleLock = useCallback(() => {
    if (!isValid) {
      setShowError(true);
      return;
    }
    save(draft.trim().toLowerCase(), true);
  }, [isValid, draft, save]);

  const handleUnlock = useCallback(() => {
    if (!payoutWallet) return;
    setConfirmUnlock(false);
    save(payoutWallet.address, false);
  }, [payoutWallet, save]);

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
        inputRef={ref}
        fullWidth
        value={isLocked ? payoutWallet.address : draft}
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
                    onClick={isLocked ? () => setConfirmUnlock(true) : handleLock}
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
      <Modal
        open={confirmUnlock}
        size="tiny"
        title={t('creator_fund.payouts.wallet.unlock_confirm.title')}
        onClose={() => setConfirmUnlock(false)}
        actions={
          <>
            <Button
              color="secondary"
              onClick={() => setConfirmUnlock(false)}
            >
              {t('creator_fund.payouts.wallet.unlock_confirm.cancel')}
            </Button>
            <Button
              variant="contained"
              onClick={handleUnlock}
            >
              {t('creator_fund.payouts.wallet.unlock_confirm.confirm')}
            </Button>
          </>
        }
      >
        <Typography variant="body2">
          {t('creator_fund.payouts.wallet.unlock_confirm.description', {
            date: formatCycleDate(CURRENT_CYCLE.end_date),
          })}
        </Typography>
      </Modal>
    </Box>
  );
});
