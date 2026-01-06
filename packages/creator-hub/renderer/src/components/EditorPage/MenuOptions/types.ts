import type { PreviewOptions } from '/shared/types/settings';

export type PreviewOptionsProps = {
  options: PreviewOptions;
  onChange: (options: PreviewOptions) => void;
};

export type PublishOptionId = 'publish-scene' | 'deploy-world' | 'deploy-land';

export type PublishOption = {
  id: PublishOptionId;
  label: string;
  action: () => void | Promise<void>;
};

export type PublishOptionsProps = {
  options: PublishOption[];
};
