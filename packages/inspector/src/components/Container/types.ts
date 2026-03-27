export type IndicatorSeverity = 'warning' | 'error';

export type Props = {
  label?: string;
  className?: string;
  rightContent?: JSX.Element;
  initialOpen?: boolean;
  indicator?: boolean | string | JSX.Element;
  indicatorSeverity?: IndicatorSeverity;
  border?: boolean;
  gap?: boolean;
  variant?: 'minimal';
  onRemoveContainer?: () => void;
};
