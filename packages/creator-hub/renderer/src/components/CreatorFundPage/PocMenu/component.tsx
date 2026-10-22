import { useCallback, useState, type MouseEvent } from 'react';
import CheckIcon from '@mui/icons-material/Check';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { Chip, Divider, ListItemIcon, Menu, MenuItem } from 'decentraland-ui2';

import { useDispatch, useSelector } from '#store';
import { SimulatedCreator, isDemoDataOn, setDemoDataOn } from '/@/lib/creatorFund';
import { actions } from '/@/modules/store/creatorFund';
import { t } from '/@/modules/store/translation/utils';

import './styles.css';

type Props = {
  /** The wallet whose demo state a reset reloads. */
  address: string | undefined;
};

/** Demo-only controls over the mock backoffice. Not a product surface. */
export function PocMenu({ address }: Props) {
  const simulated = useSelector(state => state.creatorFund.simulated);
  const dispatch = useDispatch();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  const close = useCallback(() => setAnchor(null), []);

  const handleSimulate = useCallback(
    (value: SimulatedCreator) => {
      close();
      dispatch(actions.simulateCreator(value));
    },
    [close, dispatch],
  );

  /** Every list was fetched with the old setting; a reload refetches all of them at once. */
  const handleToggleDemoData = useCallback(() => {
    close();
    setDemoDataOn(!isDemoDataOn());
    window.location.reload();
  }, [close]);

  const handleReset = useCallback(async () => {
    close();
    await dispatch(actions.resetDemo());
    if (address) dispatch(actions.loadCreatorFund({ address }));
  }, [close, dispatch, address]);

  const options = [
    { value: SimulatedCreator.ELIGIBLE, label: t('creator_fund.poc.simulate_eligible') },
    { value: SimulatedCreator.NOT_ELIGIBLE, label: t('creator_fund.poc.simulate_not_eligible') },
  ];

  return (
    <>
      <Chip
        size="small"
        variant="outlined"
        className="PocMenuChip"
        label={t('creator_fund.poc.label')}
        icon={<KeyboardArrowDownIcon />}
        aria-haspopup="menu"
        aria-expanded={!!anchor}
        onClick={(e: MouseEvent<HTMLElement>) => setAnchor(e.currentTarget)}
      />
      <Menu
        anchorEl={anchor}
        open={!!anchor}
        onClose={close}
      >
        {options.map(option => (
          <MenuItem
            key={option.value}
            selected={simulated === option.value}
            onClick={() => handleSimulate(option.value)}
          >
            <ListItemIcon>
              {simulated === option.value && <CheckIcon fontSize="small" />}
            </ListItemIcon>
            {option.label}
          </MenuItem>
        ))}
        <Divider />
        <MenuItem onClick={handleToggleDemoData}>
          <ListItemIcon>{isDemoDataOn() && <CheckIcon fontSize="small" />}</ListItemIcon>
          {t('creator_fund.poc.demo_data')}
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleReset}>
          <ListItemIcon />
          {t('creator_fund.poc.reset')}
        </MenuItem>
      </Menu>
    </>
  );
}
