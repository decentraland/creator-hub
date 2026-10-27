import { useId, type ReactNode } from 'react';
import CloseIcon from '@mui/icons-material/Close';

import { t } from '/@/modules/store/translation/utils';

import { Button } from '../../Button';
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

export type PrimaryAction = Action & { state: 'idle' | 'blocked' | 'busy' };

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
                <Button
                  variant="contained"
                  color="secondary"
                  size="large"
                  autoFocus={initialFocus === 'secondary'}
                  disabled={busy}
                  onClick={secondary.onClick}
                >
                  {secondary.label}
                </Button>
              )}
              {primary && (
                <Button
                  variant="contained"
                  color="primary"
                  size="large"
                  disabled={primary.state !== 'idle'}
                  onClick={primary.onClick}
                >
                  {busy ? <Loader size={24} /> : primary.label}
                </Button>
              )}
            </Actions>
          )}
        </Content>
      </Frame>
    </StyledDialog>
  );
}
