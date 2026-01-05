import type { PreviewOptions } from '/shared/types/settings';
import type { Project } from '/shared/types/projects';

export type ModalType = 'publish' | 'publish-history' | 'install-client' | 'warning';

export type ModalState = {
  type?: ModalType;
  onContinue?: () => void | Promise<void>;
};

export type PreviewOptionsProps = {
  options: PreviewOptions;
  onChange: (options: PreviewOptions) => void;
};

export type PublishOption = { id: 'publish-scene' | 'deploy-world' | 'deploy-land' };

export type PublishOptionsProps = {
  project?: Project;
  onClick: (option: PublishOption) => void;
};

export type ModalProps = {
  type?: ModalType;
  project: Project;
  onClose: (continued?: boolean) => void;
};
