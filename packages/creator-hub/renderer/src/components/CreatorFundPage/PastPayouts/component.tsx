import cx from 'classnames';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import {
  Box,
  Chip,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from 'decentraland-ui2';

import { misc } from '#preload';
import type { Payout } from '/@/lib/creatorFund';
import { CURRENT_CYCLE, PROGRAM, PayoutStatus } from '/@/lib/creatorFund';
import { t } from '/@/modules/store/translation/utils';

import { Loader } from '../../Loader';
import {
  formatCycleDate,
  formatCycleRange,
  formatWholeUsdc,
  formatUsdc,
  shortAddress,
  txUrl,
} from '../../CreatorFund/utils';

import './styles.css';

type Props = {
  payouts: Payout[];
  isLoading: boolean;
  /** Without this a failed request reads as "no payouts yet". */
  isFailed: boolean;
};

export function PastPayouts({ payouts, isLoading, isFailed }: Props) {
  if (isLoading && payouts.length === 0) return <Loader size={40} />;

  if (isFailed) {
    return (
      <Typography
        variant="body2"
        className="PastPayoutsEmpty"
      >
        {t('creator_fund.payouts.history.error')}
      </Typography>
    );
  }

  if (payouts.length === 0) {
    return (
      <Typography
        variant="body2"
        className="PastPayoutsEmpty"
      >
        {t('creator_fund.payouts.history.empty', {
          date: formatCycleDate(CURRENT_CYCLE.end_date),
        })}
      </Typography>
    );
  }

  return (
    <Table className="PastPayouts">
      <TableHead>
        <TableRow>
          <TableCell>{t('creator_fund.payouts.history.columns.cycle')}</TableCell>
          <TableCell>{t('creator_fund.payouts.history.columns.status')}</TableCell>
          <TableCell>{t('creator_fund.payouts.history.columns.scenes')}</TableCell>
          <TableCell align="right">{t('creator_fund.payouts.history.columns.amount')}</TableCell>
          <TableCell>{t('creator_fund.payouts.history.columns.wallet')}</TableCell>
          <TableCell className="TxCell">
            {t('creator_fund.payouts.history.columns.transaction')}
          </TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {payouts.map(payout => (
          <TableRow key={payout.cycle_id}>
            <TableCell>{formatCycleRange(payout.start_date, payout.end_date)}</TableCell>
            <TableCell>
              <Chip
                size="small"
                variant="outlined"
                className={cx('PayoutStatus', payout.status)}
                label={t(`creator_fund.payouts.history.status.${payout.status}`, {
                  minPayout: formatWholeUsdc(PROGRAM.minPayoutUsdc),
                })}
              />
            </TableCell>
            <TableCell>{payout.qualified_places}</TableCell>
            <TableCell
              align="right"
              className={cx('Amount', { Zero: payout.status !== PayoutStatus.PAID })}
            >
              {formatUsdc(payout.amount_usdc)}
            </TableCell>
            <TableCell className="Wallet">
              {payout.wallet ? shortAddress(payout.wallet) : '-'}
            </TableCell>
            <TableCell className="TxCell">
              {payout.tx_hash ? (
                <Tooltip
                  title={t('creator_fund.payouts.history.view_transaction')}
                  placement="top"
                  arrow
                >
                  <IconButton
                    size="small"
                    aria-label={t('creator_fund.payouts.history.view_transaction')}
                    onClick={() => void misc.openExternal(txUrl(payout.tx_hash!))}
                  >
                    <OpenInNewIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              ) : (
                <Box component="span">-</Box>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
