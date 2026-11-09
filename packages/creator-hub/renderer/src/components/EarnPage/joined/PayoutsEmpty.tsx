import emptyArt from '/assets/images/earn/payouts-empty.webp';

import { useSelector } from '#store';
import { selectors } from '/@/modules/store/creatorFund';
import { formatCycleDays } from '/@/modules/store/creatorFund/utils';
import { t } from '/@/modules/store/translation/utils';

import {
  EmptyArea,
  EmptyArt,
  EmptyBody,
  EmptyCopy,
  EmptyHead,
  EmptyLine,
  EmptyTitle,
} from './PayoutsTab.styled';

/** Before the first payout: when it comes, over the character art. */
export function PayoutsEmpty() {
  const locale = useSelector(state => state.translation.locale);
  const cycle = useSelector(selectors.getFirstPayoutCycle);
  return (
    <EmptyArea>
      <EmptyArt
        src={emptyArt}
        alt=""
        width={1361}
        height={822}
      />
      <EmptyCopy>
        <EmptyHead>
          <EmptyTitle>{t('earn.joined.payouts.empty.title')}</EmptyTitle>
          {cycle && (
            <EmptyLine>
              {t('earn.joined.payouts.empty.first_payout', {
                cycle: formatCycleDays(cycle, locale),
              })}
            </EmptyLine>
          )}
        </EmptyHead>
        <EmptyBody>{t('earn.joined.payouts.empty.body')}</EmptyBody>
      </EmptyCopy>
    </EmptyArea>
  );
}
