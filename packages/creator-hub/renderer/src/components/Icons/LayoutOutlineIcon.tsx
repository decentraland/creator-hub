import type { CommonProps } from './types';

export function LayoutOutlineIcon({ className }: CommonProps) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M20.5 13.7266V20.5H13.7354L13.7285 13.7266H20.5ZM10.2754 13.7266L10.2822 20.5H3.5V13.7266H10.2754ZM20.5 3.5V10.2734H13.7246L13.7178 3.5H20.5ZM10.2646 3.5L10.2715 10.2734H3.5V3.5H10.2646Z"
        stroke="currentColor"
      />
    </svg>
  );
}
