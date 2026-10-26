export type Option = {
  text: string;
  handler: () => unknown;
  disabled?: boolean;
  icon?: React.ReactNode;
  divider?: boolean;
};

export type Props = {
  label: string;
  options: Option[];
  className?: string;
  selected?: string;
};
