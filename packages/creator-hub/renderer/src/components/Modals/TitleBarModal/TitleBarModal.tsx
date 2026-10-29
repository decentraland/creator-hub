import { useId, type ReactNode } from 'react';
import CloseIcon from '@mui/icons-material/Close';

import { t } from '/@/modules/store/translation/utils';

import { Bar, BarTitle, Body, CloseButton, Frame, Panel } from './TitleBarModal.styled';

type Props = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
};

/** The DS modal shell (ReportBug): a title bar with close over a hugging content column. */
export function TitleBarModal({ open, title, onClose, children }: Props) {
  const titleId = useId();
  return (
    <Panel
      open={open}
      onClose={onClose}
      aria-labelledby={titleId}
      PaperProps={{ 'aria-modal': true }}
    >
      <Frame>
        <Bar>
          <BarTitle id={titleId}>{title}</BarTitle>
          <CloseButton
            aria-label={t('modal.close')}
            onClick={onClose}
          >
            <CloseIcon />
          </CloseButton>
        </Bar>
        <Body>{children}</Body>
      </Frame>
    </Panel>
  );
}
