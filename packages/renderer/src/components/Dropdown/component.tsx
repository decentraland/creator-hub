import React, { useCallback, useState, type MouseEvent } from 'react';
import { IconButton, MenuItem, Menu } from 'decentraland-ui2';
import ThreeDots from '@mui/icons-material/MoreVert';
import cx from 'classnames';

import type { Option, Props } from './types';

import './styles.css';

function Dropdown(props: Props) {
  const { options, className, selected } = props;
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleClick = useCallback((event: MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  }, []);

  const handleSelect = useCallback((_: MouseEvent<HTMLLIElement>, option: Option) => {
    setAnchorEl(null);
    option.handler();
  }, []);

  const handleClose = useCallback(() => {
    setAnchorEl(null);
  }, []);

  return (
    <div>
      <IconButton onClick={handleClick}><ThreeDots /></IconButton>
      <Menu
        classes={{ root: cx('Dropdown', className)}}
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
      >
        {options.map((option) => (
          <MenuItem key={option.text} selected={option.text === selected} onClick={(e) => handleSelect(e, option)}>
            {option.text}
          </MenuItem>
        ))}
      </Menu>
    </div>
  );
}

export const DropdownMemo = React.memo(Dropdown);
