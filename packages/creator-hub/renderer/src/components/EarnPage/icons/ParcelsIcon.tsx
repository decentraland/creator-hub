import type { CommonProps } from '../../Icons/types';

const PATH =
  'M14 2V7.18224H8.81708L8.81098 2H14ZM7.1816 7.18224H2V2H7.17548L7.1816 7.18224ZM14 8.81776V14H8.82452L8.81842 8.81776H14ZM7.18904 14H2V8.81776H7.18292L7.18904 14Z';

/** Figma's `layout` glyph, coloured by CSS `color`. */
export function ParcelsIcon({ className }: CommonProps) {
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
