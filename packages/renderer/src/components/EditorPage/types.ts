import type { PreviewOptions } from '/shared/types/settings';
import type { Project } from '/shared/types/projects';

export type ModalType = 'publish' | 'publish-history';
export type PublishOption = { id: 'history' };

export type PreviewOptionsProps = {
  options: PreviewOptions;
  onChange: (options: PreviewOptions) => void;
};

export type PublishOptionsProps = {
  onClick: (option: PublishOption) => void;
};

export type ModalProps = {
  type?: ModalType;
  project: Project;
  onClose: () => void;
};
