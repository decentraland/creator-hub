export type Option = {
  text: string;
  handler: () => unknown;
  disabled?: boolean;
  icon?: React.ReactNode;
  divider?: boolean;
};

export type Props = {
  options: Option[];
  className?: string;
  selected?: string;
};
