import type { CommonProps } from '../../Icons/types';

const PATH =
  'M14.0334 8.29878L10.5255 4.79271C9.9002 4.16771 8.84785 4.60978 8.84785 5.49392V6.65245C8.81735 6.65245 8.8021 6.65245 8.7716 6.65245H5.44423C4.87993 6.65245 4.42238 7.09452 4.42238 7.65854V10.3262C4.42238 10.8902 4.87993 11.3475 5.44423 11.3475H8.75634C8.78685 11.3475 8.8021 11.3475 8.8326 11.3475V12.5061C8.8326 13.3902 9.9002 13.8323 10.5103 13.2073L14.0181 9.70122C14.4146 9.30488 14.4146 8.67988 14.0334 8.29878Z';

/** Figma's EARN glyph, coloured by CSS `color`. */
export function JumpInIcon({ className }: CommonProps) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      aria-hidden
      focusable="false"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        width="18"
        height="18"
        rx="6"
        style={{ fill: 'var(--primary)' }}
      />
      <rect
        x="0.5625"
        y="0.5625"
        width="16.875"
        height="16.875"
        rx="5.4375"
        stroke="currentColor"
        strokeOpacity="0.3"
        strokeWidth="1.125"
      />
      <path
        d={PATH}
        fill="currentColor"
      />
    </svg>
  );
}
