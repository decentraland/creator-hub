import { useCallback, useState } from 'react';
import cx from 'classnames';
import { Button as DclButton, ButtonGroup as DclButtonGroup } from 'decentraland-ui2';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';

import { Popper } from '../Popper';

import type { ButtonProps, GroupProps } from './types';

import './styles.css';

export function Button({ children, className = '', onClick, ...props }: ButtonProps) {
  return (
    <DclButton
      {...props}
      className={cx('Button', className)}
      onClick={onClick}
    >
      {children}
    </DclButton>
  );
}

export function ButtonGroup({ extra, 'data-testid': dataTestId, ...props }: GroupProps) {
  const [open, setOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const handleToggle = useCallback((e: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(e.currentTarget);
    setOpen(prev => !prev);
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
    setAnchorEl(null);
  }, []);

  return (
    <>
      <DclButtonGroup
        variant="contained"
        data-testid={dataTestId}
      >
        <Button
          {...props}
          data-testid="button-group-button"
        />
        <Button
          className="extra-button"
          color={props.color}
          size="small"
          onClick={handleToggle}
          data-testid="button-group-extra-button"
        >
          <ArrowDropDownIcon />
        </Button>
        {open && (
          <Popper
            open={open}
            onClose={handleClose}
            anchorEl={anchorEl}
            placement="bottom-end"
            data-testid="button-group-popper"
          >
            {extra}
          </Popper>
        )}
      </DclButtonGroup>
    </>
  );
}
