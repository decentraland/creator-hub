import type React from 'react';

export type Props = React.InputHTMLAttributes<HTMLElement> & {
  label?: React.ReactNode;
  basic?: boolean;
  // adds a "None" entry that emits '' so an optional colour can be unset again
  clearable?: boolean;
};

export type ColorOptions = {
  label: string;
  value?: React.InputHTMLAttributes<HTMLElement>['value'];
  leftContent?: React.ReactNode;
  secondaryText?: string;
  selected?: boolean;
  disabled?: boolean;
};
