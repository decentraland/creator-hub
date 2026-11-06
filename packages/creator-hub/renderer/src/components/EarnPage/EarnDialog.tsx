import { t } from '/@/modules/store/translation/utils';

import {
  CloseButton,
  GlowLayer,
  StatusDialog,
  StatusGlow,
  WelcomePaper,
  WelcomeRoot,
} from './EarnModal.styled';
import { CloseIcon } from './icons';

/**
 * The EARN modal shell over the Black 80 overlay; the overlay, Escape and the close button all
 * call `onClose`.
 */
export function EarnDialog({
  labelledBy,
  onClose,
  children,
}: {
  labelledBy: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <WelcomeRoot
      open
      onClose={onClose}
    >
      <WelcomePaper
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
      >
        <StatusDialog>
          <GlowLayer aria-hidden>
            <StatusGlow />
          </GlowLayer>
          <CloseButton
            aria-label={t('earn.close')}
            onClick={onClose}
          >
            <CloseIcon />
          </CloseButton>
          {children}
        </StatusDialog>
      </WelcomePaper>
    </WelcomeRoot>
  );
}
