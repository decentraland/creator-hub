export type Props = {
  label: string;
  info?: string;
  addLabel: string;
  removeLabel: string;
  value: readonly string[];
  onChange: (value: string[]) => void;
};
