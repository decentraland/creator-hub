import type { CommonProps } from '../../Icons/types';

const PATH =
  'M14 1H10C9.45 1 9 1.45 9 2C9 2.55 9.45 3 10 3H14C14.55 3 15 2.55 15 2C15 1.45 14.55 1 14 1ZM12 14C12.55 14 13 13.55 13 13V9C13 8.45 12.55 8 12 8C11.45 8 11 8.45 11 9V13C11 13.55 11.45 14 12 14ZM19.03 7.39L19.78 6.64C20.16 6.26 20.17 5.63 19.78 5.24L19.77 5.23C19.38 4.84 18.76 4.85 18.37 5.23L17.62 5.98C16.07 4.74 14.12 4 12 4C7.2 4 3.12 7.96 3 12.76C2.87 17.84 6.94 22 12 22C16.98 22 21 17.97 21 13C21 10.88 20.26 8.93 19.03 7.39ZM12 20C8.13 20 5 16.87 5 13C5 9.13 8.13 6 12 6C15.87 6 19 9.13 19 13C19 16.87 15.87 20 12 20Z';

/** Figma's EARN glyph, coloured by CSS `color`. */
export function PlaytimeIcon({ className }: CommonProps) {
  return (
    <svg
      className={className}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      focusable="false"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d={PATH}
        fill="url(#cf-cerise)"
      />
    </svg>
  );
}
