import type { Component } from '../../../lib/sdk/components';
import type { Props as DropdownProps } from '../Dropdown/types';

export type Props = Pick<
  DropdownProps,
  'className' | 'disabled' | 'label' | 'value' | 'onChange'
> & {
  components?: Component[];
};
