import { useCallback, useState } from 'react';
import cx from 'classnames';
import { Button, Divider, IconButton, Menu, MenuItem } from 'decentraland-ui2';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';

import type { Props, ActionsProps } from './types';

import './styles.css';

export function ButtonComponent({
  children,
  className = '',
  onClick,
  actions = [],
  actionableIcon,
  ...props
}: Props) {
  return (
    <Button
      {...props}
      className={cx('Button', className)}
      onClick={onClick}
    >
      {children}
      <Actions
        actions={actions}
        icon={actionableIcon}
      />
    </Button>
  );
}

function Actions({ actions, icon }: ActionsProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleOpen = useCallback((event: React.MouseEvent<HTMLElement, MouseEvent>) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  }, []);

  const handleClose = useCallback((event: React.MouseEvent<HTMLElement, MouseEvent>) => {
    event.stopPropagation();
    setAnchorEl(null);
  }, []);

  const handleClick = useCallback(
    (fn: () => void) => (event: React.MouseEvent<HTMLElement, MouseEvent>) => {
      event.stopPropagation();
      setAnchorEl(null);
      fn();
    },
    [],
  );

  if (!actions.length) return null;

  return (
    <div className="Actions">
      <Divider
        orientation="vertical"
        flexItem
        sx={{ mx: 0.5 }}
      />
      <IconButton
        onClick={handleOpen}
        size="large"
      >
        {icon ?? <ArrowDropDownIcon />}
      </IconButton>
      <Menu
        id="ActionsMenu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
      >
        {actions.map(({ label, onClick }, i) => (
          <MenuItem
            key={i}
            onClick={handleClick(onClick)}
          >
            {label}
          </MenuItem>
        ))}
      </Menu>
    </div>
  );
}
