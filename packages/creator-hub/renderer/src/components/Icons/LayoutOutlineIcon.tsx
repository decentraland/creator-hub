import { useId } from 'react';

import type { CommonProps } from './types';

export function LayoutOutlineIcon({ className }: CommonProps) {
  const maskId = useId();
  return (
    <svg
      className={className}
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
    >
      <mask
        id={maskId}
        fill="white"
      >
        <path d="M13.5 0V5.83002H7.66921L7.66236 0H13.5ZM5.8293 5.83002H0V0H5.82242L5.8293 5.83002ZM13.5 7.66998V13.5H7.67759L7.67073 7.66998H13.5ZM5.83767 13.5H0V7.66998H5.83078L5.83767 13.5Z" />
      </mask>
      <path
        d="M13.5 0V5.83002H7.66921L7.66236 0H13.5ZM5.8293 5.83002H0V0H5.82242L5.8293 5.83002ZM13.5 7.66998V13.5H7.67759L7.67073 7.66998H13.5ZM5.83767 13.5H0V7.66998H5.83078L5.83767 13.5Z"
        strokeWidth="2"
        stroke="currentColor"
        mask={`url(#${maskId})`}
      />
    </svg>
  );
}
