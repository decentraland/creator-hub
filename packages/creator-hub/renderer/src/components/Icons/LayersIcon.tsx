import type { CommonProps } from './types';

export function LayersIcon({ className }: CommonProps) {
  return (
    <svg
      className={className}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M20 14.196L12.5005 20L5 14.197L6.07267 13.367L12.4913 18.3319L18.9181 13.358L20 14.196Z"
        fill="currentColor"
      />
      <path
        d="M19.999 9.80296L18.7824 10.7419L12.4995 15.6069L5 9.80397L12.5005 4L19.999 9.80296ZM12.5005 5.66997L7.16269 9.80397L12.5005 13.9399L17.8383 9.80397L12.5005 5.66997Z"
        fillRule="evenodd"
        clipRule="evenodd"
        fill="currentColor"
      />
    </svg>
  );
}
