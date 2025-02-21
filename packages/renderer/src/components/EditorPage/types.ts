import type { PreviewOptions } from '/shared/types/settings';

export type PreviewOptionsProps = {
  options: PreviewOptions;
  onChange: (options: PreviewOptions) => void;
};
