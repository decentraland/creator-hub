import type { Project } from '/shared/types/projects';
import type { Step as PublishStep } from '/@/components/Modals/PublishProject/types';

export type ModalType = 'publish' | 'publish-history' | 'install-client' | 'warning';

export type ModalState = {
  type?: ModalType;
  onContinue?: () => void | Promise<void>;
  initialStep?: PublishStep;
};

export type Props = {
  type?: ModalType;
  project: Project;
  onClose: (continued?: boolean) => void;
  initialStep?: PublishStep;
};
