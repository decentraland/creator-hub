import { CircularProgress } from 'decentraland-ui2';

import { SpinnerBox } from './EarnModal.styled';

/** A primary spinner announced as one named progressbar; MUI's own one is hidden inside it. */
export function Spinner({ label, size }: { label: string; size?: number }) {
  return (
    <SpinnerBox
      role="progressbar"
      aria-label={label}
    >
      <CircularProgress
        aria-hidden
        size={size}
        color="primary"
      />
    </SpinnerBox>
  );
}
