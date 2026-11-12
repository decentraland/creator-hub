import { useId, useState } from 'react';

import type { Payout } from '/shared/types/creator-fund';

import { analytics, misc } from '#preload';
import { useSelector } from '#store';
import { formatCycleLabel } from '/@/modules/store/creatorFund/utils';
import { t } from '/@/modules/store/translation/utils';

import { CollapseIcon, ExpandIcon, MapPinIcon, TransactionIcon } from '../icons';

import { formatCount, formatUsdc, placeLocation, placeTitle } from './format';
import {
  PlaceCell,
  PlaceName,
  PlaceText,
  PlaceWhere,
  PlaceWhereText,
  Thumbnail,
} from './LeaderboardTab.styled';
import {
  CycleCell,
  CycleRow,
  Disclosure,
  DisclosureLabel,
  Figure,
  HeaderCell,
  HeaderRow,
  PlaceRow,
  PlaceSpan,
  StatusPill,
  Table,
  TransactionButton,
  TransactionCell,
} from './PayoutsTab.styled';
import { useWorldSceneCounts } from './useWorldSceneCounts';

const COLUMNS = ['cycle', 'status', 'paid_places', 'amount', 'transaction'] as const;

const ETHERSCAN_TX = 'https://etherscan.io/tx/';

function Usdc({ amount }: { amount: string }) {
  const locale = useSelector(state => state.translation.locale);
  return (
    <Figure role="cell">
      {t('earn.joined.payouts.table.usdc', { amount: formatUsdc(amount, locale) })}
    </Figure>
  );
}

function TransactionLink({ hash }: { hash: string | null }) {
  return (
    <TransactionCell role="cell">
      {hash && (
        <TransactionButton
          type="button"
          aria-label={t('earn.joined.payouts.table.view_transaction')}
          onClick={() => {
            void analytics.track('Creator Fund Transaction Viewed', undefined);
            void misc.openExternal(`${ETHERSCAN_TX}${hash}`);
          }}
        >
          <TransactionIcon />
        </TransactionButton>
      )}
    </TransactionCell>
  );
}

function PayoutRows({
  payout,
  open,
  onToggle,
  sceneCounts,
}: {
  payout: Payout;
  open: boolean;
  onToggle: () => void;
  sceneCounts: Record<string, number>;
}) {
  const locale = useSelector(state => state.translation.locale);
  const id = useId();
  const placeIds = payout.places.map((_, index) => `${id}-${index}`);
  return (
    <>
      <CycleRow role="row">
        <CycleCell role="cell">
          <Disclosure
            type="button"
            aria-expanded={open}
            aria-controls={open ? placeIds.join(' ') : undefined}
            onClick={onToggle}
          >
            {open ? <CollapseIcon /> : <ExpandIcon />}
            <DisclosureLabel>{formatCycleLabel(payout.cycle, locale)}</DisclosureLabel>
          </Disclosure>
        </CycleCell>
        <span role="cell">
          <StatusPill data-status={payout.status}>
            {t(`earn.joined.payouts.table.${payout.status}`)}
          </StatusPill>
        </span>
        <Figure role="cell">{formatCount(payout.paid_places, locale)}</Figure>
        <Usdc amount={payout.amount_usdc} />
        <TransactionLink hash={payout.transaction_hash} />
      </CycleRow>
      {open &&
        payout.places.map(({ place, amount_usdc }, index) => (
          <PlaceRow
            key={place.id}
            id={placeIds[index]}
            role="row"
          >
            <PlaceSpan
              role="cell"
              aria-colspan={3}
            >
              <PlaceCell>
                <Thumbnail
                  src={place.image ?? undefined}
                  alt=""
                  width={89}
                  height={50}
                  loading="lazy"
                />
                <PlaceText>
                  <PlaceName title={placeTitle(place)}>{placeTitle(place)}</PlaceName>
                  <PlaceWhere>
                    <MapPinIcon />
                    <PlaceWhereText
                      title={placeLocation(place, sceneCounts[place.world_name ?? ''])}
                    >
                      {placeLocation(place, sceneCounts[place.world_name ?? ''])}
                    </PlaceWhereText>
                  </PlaceWhere>
                </PlaceText>
              </PlaceCell>
            </PlaceSpan>
            <Usdc amount={amount_usdc} />
            <span role="cell" />
          </PlaceRow>
        ))}
    </>
  );
}

/** The payouts, one disclosure row per cycle with its paid places; the newest starts open. */
export function PayoutsTable({ payouts }: { payouts: Payout[] }) {
  const [open, setOpen] = useState<ReadonlySet<number>>(() => new Set([payouts[0]?.cycle.id]));
  const sceneCounts = useWorldSceneCounts(
    payouts.flatMap(payout => payout.places.map(entry => entry.place)),
  );
  const toggle = (cycleId: number) =>
    setOpen(current => {
      const next = new Set(current);
      if (!next.delete(cycleId)) next.add(cycleId);
      return next;
    });

  return (
    <Table
      role="table"
      aria-label={t('earn.joined.payouts.table.label')}
    >
      <div role="rowgroup">
        <HeaderRow role="row">
          {COLUMNS.map(column => (
            <HeaderCell
              key={column}
              role="columnheader"
            >
              {t(`earn.joined.payouts.table.${column}`)}
            </HeaderCell>
          ))}
        </HeaderRow>
      </div>
      <div role="rowgroup">
        {payouts.map(payout => (
          <PayoutRows
            key={payout.cycle.id}
            payout={payout}
            open={open.has(payout.cycle.id)}
            onToggle={() => toggle(payout.cycle.id)}
            sceneCounts={sceneCounts}
          />
        ))}
      </div>
    </Table>
  );
}
