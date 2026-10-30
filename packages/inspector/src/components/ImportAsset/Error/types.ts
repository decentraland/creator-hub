import type { Asset } from '../types';

export type Action = {
  name: string;
  onClick: () => void;
};

export type PropTypes = {
  assets: Asset[];
  errorMessage: string;
  description?: React.ReactNode;
  primaryAction: Action;
  secondaryAction?: Action;
};
