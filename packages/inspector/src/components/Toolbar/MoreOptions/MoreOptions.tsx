import React from 'react';
import { BiCheckbox, BiCheckboxChecked } from 'react-icons/bi';

import { Dropdown } from '../../ui';
import type { Props as OptionProps } from '../../ui/Dropdown/Option/types';
import { KebabIcon } from '../icons';

/** The box glyph a checkable menu entry shows as its `leftIcon`. */
export const checkboxIcon = (checked: boolean) =>
  checked ? <BiCheckboxChecked aria-hidden /> : <BiCheckbox aria-hidden />;

/** The toolbar's ⋮ menu, set off from the buttons before it by a rule. */
export const MoreOptions: React.FC<{ options: OptionProps[] }> = ({ options }) => (
  <div className="ToolbarMore">
    <Dropdown
      className="toolbar-more"
      trigger={<KebabIcon />}
      aria-label="More options"
      menuAlign="right"
      options={options}
    />
  </div>
);
