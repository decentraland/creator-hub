import { Alert, AlertTitle, CircularProgress as Loader } from 'decentraland-ui2';

import { type GenericNotification } from '/@/modules/store/snackbar/types';

import { StyledAlert, StyledDescription } from './Generic.styled';

type Props = GenericNotification & { onClose?: () => void };

export function Generic({ severity, message, description, onClose }: Props) {
  const props = severity === 'loading' ? { icon: <Loader size={20} /> } : { severity };
  // Carries the severity so a test can assert an error was surfaced, not merely some
  // notification. The wrapping ".Snackbar" div is presentational and would break on a
  // style refactor.
  const testId = `snackbar-generic-${severity}`;

  if (description) {
    return (
      <StyledAlert
        {...props}
        data-testid={testId}
        onClose={onClose}
      >
        <AlertTitle>{message}</AlertTitle>
        <StyledDescription>{description}</StyledDescription>
      </StyledAlert>
    );
  }

  return (
    <Alert
      {...props}
      data-testid={testId}
    >
      {message}
    </Alert>
  );
}
