import type React from 'react';

export type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> & {
  type?: 'text' | 'password' | 'email' | 'number';
  size?: 'dense' | 'large';
  label?: React.ReactNode;
  leftLabel?: React.ReactNode;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  rightLabel?: React.ReactNode;
  error?: string | boolean;
  className?: string;
  disabled?: boolean;
  leftContent?: React.ReactNode;
  debounceTime?: number;
  autoSelect?: boolean;
};
