import type { CommonProps } from '../../Icons/types';

const PATH =
  'M10.2267 0.366095C10.5767 -0.0609863 11.2067 -0.123422 11.6339 0.226446C12.061 0.576411 12.1234 1.20647 11.7736 1.63367L5.22182 9.63367C5.03994 9.85563 4.7713 9.98848 4.48452 9.99891C4.1978 10.0093 3.92027 9.89649 3.7228 9.68836L0.274558 6.05164C-0.105451 5.65091 -0.0890407 5.01761 0.311667 4.63758C0.712418 4.25756 1.34571 4.27491 1.72573 4.67566L4.39272 7.48816L10.2267 0.366095Z';

/** Figma's EARN checkbox tick (`Checkmark (Stroke)`), coloured by CSS `color`. */
export function CheckboxTickIcon({ className }: CommonProps) {
  return (
    <svg
      className={className}
      width="12"
      height="10"
      viewBox="0 0 12 10"
      fill="none"
      aria-hidden
      focusable="false"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d={PATH}
        fill="currentColor"
      />
    </svg>
  );
}
