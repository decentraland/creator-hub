export type ComponentOption = {
  id?: number;
  value?: string;
  header?: string;
  onClick?: () => void;
  disabled?: boolean;
  tooltip?: { text: string; link?: string };
};

export type ComponentRules = {
  requires?: number[] | number[][];
  conflictsWith?: number[];
};

export type TooltipConfig = {
  description: string;
  link?: string;
  disabledMessage?: string;
};
