import cx from 'classnames';
import { Box, ManaMaticIcon } from 'decentraland-ui2';

import './styles.css';

type Props = {
  /** Already formatted, so callers decide about decimals and "no data". */
  children: string;
  className?: string;
};

/**
 * A MANA amount with its icon. Deliberately not decentraland-ui2's `Mana`:
 * that renders a ButtonBase, which puts a focusable, dead button in read-only
 * places like table cells and metric cards.
 */
export function ManaValue({ children, className }: Props) {
  return (
    <Box className={cx('ManaValue', className)}>
      <ManaMaticIcon fontSize="small" />
      {children}
    </Box>
  );
}
