import type { PreviewOptions } from '/shared/types/settings';
import type { Project } from '/shared/types/projects';

export type PreviewOptionsProps = {
  options: PreviewOptions;
  onChange: (options: PreviewOptions) => void;
};

export type PublishOption = { id: 'publish-scene' | 'deploy-world' | 'deploy-land' };

export type PublishOptionsProps = {
  project?: Project;
  isDeploying?: boolean;
  onClick: (option: PublishOption) => void;
};
