export type Option = {
  text: string;
  handler: () => unknown;
  disabled?: boolean;
  icon?: React.ReactNode;
  divider?: boolean;
  tone?: 'default' | 'danger';
};

export type Props = {
  label: string;
  options: Option[];
  variant?: 'ghost' | 'filled';
  className?: string;
  selected?: string;
};
