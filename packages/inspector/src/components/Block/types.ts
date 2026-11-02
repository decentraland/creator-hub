export type Props = {
  label?: React.ReactNode;
  info?: React.ReactNode;
  error?: boolean;
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
};
