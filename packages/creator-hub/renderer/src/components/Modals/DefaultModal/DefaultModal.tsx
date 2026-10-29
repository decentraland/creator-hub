import { useId, type ReactNode } from 'react';
import CloseIcon from '@mui/icons-material/Close';

import { t } from '/@/modules/store/translation/utils';

import { DialogButton } from '../../DialogButton';
import { Loader } from '../../Loader';
import {
  Actions,
  Body,
  CloseButton,
  Content,
  Frame,
  Group,
  StyledDialog,
  Title,
} from './DefaultModal.styled';

type Action = { label: string; onClick: () => void };

type PrimaryAction = Action & { state: 'idle' | 'blocked' | 'busy' };

type Props = {
  open: boolean;
  title: string;
  onClose: () => void;
  body?: ReactNode;
  children?: ReactNode;
  secondary?: Action;
  primary?: PrimaryAction;
  initialFocus?: 'secondary' | 'content';
  corner?: 'close' | 'none';
};

/** DefaultModal's content, for a modal that swaps one step for another while staying open. */
export type ModalStep = Omit<Props, 'open'>;

/** The DS DefaultModal: title, body, optional content and a Secondary + Primary action row. */
export function DefaultModal({
  open,
  title,
  onClose,
  body,
  children,
  secondary,
  primary,
  initialFocus = 'secondary',
  corner = 'close',
}: Props) {
  const titleId = useId();
  const bodyId = useId();
  const busy = primary?.state === 'busy';

  return (
    <StyledDialog
      open={open}
      onClose={onClose}
      aria-labelledby={titleId}
      aria-describedby={body ? bodyId : undefined}
    >
      <Frame>
        {corner === 'close' && (
          <CloseButton
            aria-label={t('modal.close')}
            onClick={onClose}
          >
            <CloseIcon />
          </CloseButton>
        )}
        <Content>
          <Title id={titleId}>{title}</Title>
          {(body || children) && (
            <Group>
              {body && <Body id={bodyId}>{body}</Body>}
              {children}
            </Group>
          )}
          {(secondary || primary) && (
            <Actions>
              {secondary && (
                <DialogButton
                  type="button"
                  tone="secondary"
                  autoFocus={initialFocus === 'secondary'}
                  disabled={busy}
                  onClick={secondary.onClick}
                >
                  {secondary.label}
                </DialogButton>
              )}
              {primary && (
                <DialogButton
                  type="button"
                  tone="primary"
                  disabled={primary.state !== 'idle'}
                  onClick={primary.onClick}
                >
                  {busy ? <Loader size={24} /> : primary.label}
                </DialogButton>
              )}
            </Actions>
          )}
        </Content>
      </Frame>
    </StyledDialog>
  );
}
