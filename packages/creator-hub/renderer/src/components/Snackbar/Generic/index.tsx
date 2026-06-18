import { Alert, AlertTitle, CircularProgress as Loader } from 'decentraland-ui2';

import { type GenericNotification } from '/@/modules/store/snackbar/types';

import { StyledAlert, StyledDescription } from './Generic.styled';

type Props = GenericNotification & { onClose?: () => void };

export function Generic({ severity, message, description, onClose }: Props) {
  const props = severity === 'loading' ? { icon: <Loader size={20} /> } : { severity };

  if (description) {
    return (
      <StyledAlert
        {...props}
        onClose={onClose}
      >
        <AlertTitle>{message}</AlertTitle>
        <StyledDescription>{description}</StyledDescription>
      </StyledAlert>
    );
  }

  return <Alert {...props}>{message}</Alert>;
}
