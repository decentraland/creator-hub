import { CircularProgress } from 'decentraland-ui2';

import { CheckingSpinnerBox, SpinnerArc, SpinnerBox, SpinnerTrack } from './EarnModal.styled';

const CHECKING_RING = 59.33;
const CHECKING_THICKNESS = 4.45;

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

/** The eligibility check's spinner: a round-capped Primary arc over a Snow 30 % track in an 80 box. */
export function CheckingSpinner({ label }: { label: string }) {
  return (
    <CheckingSpinnerBox
      role="progressbar"
      aria-label={label}
    >
      <SpinnerTrack
        aria-hidden
        variant="determinate"
        value={100}
        size={CHECKING_RING}
        thickness={CHECKING_THICKNESS}
      />
      <SpinnerArc
        aria-hidden
        disableShrink
        size={CHECKING_RING}
        thickness={CHECKING_THICKNESS}
        color="primary"
      />
    </CheckingSpinnerBox>
  );
}
