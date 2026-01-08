import type { PreviewOptions } from '/shared/types/settings';
import type { Project } from '/shared/types/projects';

export type ModalType = 'publish' | 'publish-history' | 'install-client' | 'warning' | 'mobile-qr';

export type ModalState = {
  type?: ModalType;
  onContinue?: () => void | Promise<void>;
};

export type PreviewOptionsProps = {
  options: PreviewOptions;
  onChange: (options: PreviewOptions) => void;
  onShowMobileQR: () => void;
};

export type PublishOption = { id: 'history' };

export type PublishOptionsProps = {
  onClick: (option: PublishOption) => void;
};

export type ModalProps = {
  type?: ModalType;
  project: Project;
  onClose: (continued?: boolean) => void;
  mobileQRData: MobileQRData | null;
};

export type MobileQRData = {
  url: string;
  qr: string;
};
