import emptyWallet from '/assets/images/empty-wallet.svg';

import { t } from '/@/modules/store/translation/utils';

import { Illustration, LockedPanel, Title } from './PayoutsLocked.styled';

/**
 * Payout wallet setup opens on 25 November. Until then the Payouts tab shows only this notice and
 * requests nothing, so a backend that is down or not deployed yet can't put an error in its place.
 * Set to false to bring back the full PayoutsTab.
 */
export const PAYOUT_SETUP_LOCKED = true;

/** The Payouts tab before payout wallet setup opens: a wallet illustration and the unlock date. */
export function PayoutsLocked() {
  return (
    <LockedPanel>
      <Illustration
        src={emptyWallet}
        alt=""
        width={80}
        height={80}
      />
      <Title>{t('earn.joined.payouts.locked')}</Title>
    </LockedPanel>
  );
}
