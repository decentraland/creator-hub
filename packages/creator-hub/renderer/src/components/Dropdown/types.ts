export type Option = {
  text: string;
  handler: () => unknown;
  disabled?: boolean;
};

export type Props = {
  options: Option[];
  className?: string;
  selected?: string;
};
