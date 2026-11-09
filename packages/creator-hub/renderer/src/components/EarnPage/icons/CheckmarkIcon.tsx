import type { CommonProps } from '../../Icons/types';

const PATH =
  'M5.89571 13L1 8.25988L2.22393 7.07484L5.89571 10.6299L13.7761 3L15 4.18503L5.89571 13Z';

/** Figma's EARN glyph, coloured by CSS `color`. */
export function CheckmarkIcon({ className }: CommonProps) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 16 16"
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
