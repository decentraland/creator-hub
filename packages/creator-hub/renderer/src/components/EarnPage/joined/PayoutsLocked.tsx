import emptyWallet from '/assets/images/empty-wallet.svg';

import { t } from '/@/modules/store/translation/utils';

import { Illustration, LockedPanel, Title } from './PayoutsLocked.styled';

/** The Payouts tab in place of `PayoutsTab` while the `creatorhub-creator-fund-payout` flag is off. */
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
