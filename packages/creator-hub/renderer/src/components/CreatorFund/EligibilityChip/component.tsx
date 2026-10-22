import cx from 'classnames';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import PaidIcon from '@mui/icons-material/Paid';
import { Chip, Tooltip } from 'decentraland-ui2';

import { useSelector } from '#store';
import type { FundPlaceKey } from '/@/lib/creatorFund';
import { PlaceFundStatus, selectors } from '/@/modules/store/creatorFund';
import { t } from '/@/modules/store/translation/utils';

import './styles.css';

type Props = {
  fundKey: FundPlaceKey;
  className?: string;
};

const LABELS = {
  [PlaceFundStatus.IN_FUND]: () => t('creator_fund.chip.in_fund'),
  [PlaceFundStatus.ELIGIBLE]: () => t('creator_fund.chip.eligible'),
  [PlaceFundStatus.NOT_ELIGIBLE]: () => t('creator_fund.chip.not_eligible'),
};

const ICONS = {
  [PlaceFundStatus.IN_FUND]: <CheckCircleIcon />,
  [PlaceFundStatus.ELIGIBLE]: <PaidIcon />,
  [PlaceFundStatus.NOT_ELIGIBLE]: <InfoOutlinedIcon />,
};

/** A place's Creator Fund standing. Renders nothing until the backoffice has answered. */
export function EligibilityChip({ fundKey, className }: Props) {
  const status = useSelector(state => selectors.getPlaceFundStatus(state, fundKey));
  const place = useSelector(state => selectors.getPlaceEligibility(state, fundKey));

  if (!status || !place) return null;

  const reason = place.opt_in.reasons[0];
  const chip = (
    <Chip
      size="small"
      icon={ICONS[status]}
      label={LABELS[status]()}
      className={cx('EligibilityChip', status, className)}
      // The reason lives in the tooltip; the chip is its keyboard target.
      tabIndex={reason ? 0 : undefined}
    />
  );

  return reason ? (
    <Tooltip
      title={t(`creator_fund.chip.reasons.${reason}`)}
      placement="top"
      arrow
    >
      {chip}
    </Tooltip>
  ) : (
    chip
  );
}
