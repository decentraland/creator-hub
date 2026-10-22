type NativeButton = React.DetailedHTMLProps<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  HTMLButtonElement
>;

export type PropTypes = Omit<NativeButton, 'color'> & {
  /** @default 'text' */
  variant?: 'contained' | 'outlined' | 'text';
  /** @default 'primary' */
  color?: 'primary' | 'secondary' | 'info';
  /** @default 'medium' */
  size?: 'small' | 'medium' | 'large';
};
