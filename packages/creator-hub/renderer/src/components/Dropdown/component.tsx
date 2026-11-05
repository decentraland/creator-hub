import React, { useCallback, useState, type MouseEvent } from 'react';
import cx from 'classnames';
import { MenuItem, useMediaQuery } from 'decentraland-ui2';

import { KebabIcon } from '../Icons';
import type { Option, Props } from './types';
import { MenuSeparator, StyledMenu, Trigger } from './component.styled';
import { useArrowKeyed } from './useArrowKeyed';

function Dropdown(props: Props) {
  const { label, options, className, selected, variant = 'ghost' } = props;
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const { arrowKeyedClass, onKeyDownCapture, resetArrowKeyed } = useArrowKeyed();
  const open = Boolean(anchorEl);
  const hasGlyphs = options.some(option => option.icon);

  const handleClick = useCallback((e: MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    e.currentTarget.focus();
    resetArrowKeyed();
    setAnchorEl(e.currentTarget);
  }, []);

  const handleSelect = useCallback((e: MouseEvent<HTMLLIElement>, option: Option) => {
    e.stopPropagation();
    setAnchorEl(null);
    option.handler();
  }, []);

  const handleClose = useCallback((e: MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    setAnchorEl(null);
  }, []);

  return (
    <>
      <Trigger
        look={variant}
        onClick={handleClick}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <KebabIcon />
      </Trigger>
      <StyledMenu
        className={cx(className, arrowKeyedClass)}
        onKeyDownCapture={onKeyDownCapture}
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        disableScrollLock
        transitionDuration={reduceMotion ? 0 : 'auto'}
        MenuListProps={{ 'aria-label': label }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        {options.flatMap(option => [
          <MenuItem
            key={option.text}
            className={option.tone === 'danger' ? 'Danger' : undefined}
            selected={option.text === selected}
            onClick={e => handleSelect(e, option)}
            disabled={option.disabled}
          >
            {hasGlyphs && <span className="MenuGlyph">{option.icon}</span>}
            {option.text}
          </MenuItem>,
          ...(option.divider
            ? [
                <MenuSeparator
                  key={`${option.text}-separator`}
                  role="separator"
                />,
              ]
            : []),
        ])}
      </StyledMenu>
    </>
  );
}

export const DropdownMemo = React.memo(Dropdown);
