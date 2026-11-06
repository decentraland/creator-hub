import { useId } from 'react';

import type { CommonProps } from '../../Icons/types';

const PATH =
  'M14.25 4.8075L13.1925 3.75L9 7.9425L4.8075 3.75L3.75 4.8075L7.9425 9L3.75 13.1925L4.8075 14.25L9 10.0575L13.1925 14.25L14.25 13.1925L10.0575 9L14.25 4.8075Z';

/** Figma's EARN close glyph: filled by CSS `color`, with its inner stroke in `--cf-close-stroke` (Snow). */
export function CloseIcon({ className }: CommonProps) {
  const id = useId().replace(/:/g, '');
  const shape = `${id}-shape`;
  const mask = `${id}-mask`;
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
      <use
        href={`#${shape}`}
        fill="currentColor"
      />
      <mask
        id={mask}
        maskUnits="userSpaceOnUse"
        x="2.75"
        y="2.75"
        width="12"
        height="12"
        fill="black"
      >
        <rect
          fill="white"
          x="2.75"
          y="2.75"
          width="12"
          height="12"
        />
        <use href={`#${shape}`} />
      </mask>
      <path
        d={PATH}
        strokeWidth="0.6"
        style={{ stroke: 'var(--cf-close-stroke, var(--palette-neutral-softWhite))' }}
        mask={`url(#${mask})`}
      />
      <defs>
        <path
          id={shape}
          d={PATH}
        />
      </defs>
    </svg>
  );
}
