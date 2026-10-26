import type { CommonProps } from './types';

export function KebabIcon({ className }: CommonProps) {
  return (
    <svg
      className={className}
      width="1em"
      height="1em"
      viewBox="0 0 4 20"
      fill="none"
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M2 4C3.1 4 4 3.1 4 2C4 0.9 3.1 0 2 0C0.9 0 0 0.9 0 2C0 3.1 0.9 4 2 4ZM2 8C0.9 8 0 8.9 0 10C0 11.1 0.9 12 2 12C3.1 12 4 11.1 4 10C4 8.9 3.1 8 2 8ZM2 16C0.9 16 0 16.9 0 18C0 19.1 0.9 20 2 20C3.1 20 4 19.1 4 18C4 16.9 3.1 16 2 16Z"
        fill="currentColor"
      />
    </svg>
  );
}
