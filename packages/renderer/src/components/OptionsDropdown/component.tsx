import React from 'react';
import {MenuItem, Select} from 'decentraland-ui2';
import classnames from 'classnames';

import {preventDefault} from '../../modules/event';
import type {Props} from './types';

import './styles.css';

function OptionsDropdown(props: Props) {
  const {options, className} = props;
  const classes = ['OptionsDropdown'];
  if (className) {
    classes.push(className);
  }

  return (
    <Select
      className={classnames(...classes)}
      onClick={preventDefault()}
    >
      {options.map(option => (
        <MenuItem
          key={option.text}
          value={option.text}
          onClick={option.handler}
        >
          {option.text}
        </MenuItem>
      ))}
    </Select>
  );
}

export const OptionsDropdownMemo = React.memo(OptionsDropdown);
