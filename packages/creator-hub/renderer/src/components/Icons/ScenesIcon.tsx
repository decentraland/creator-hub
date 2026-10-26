import type { CommonProps } from './types';

export function ScenesIcon({ className }: CommonProps) {
  return (
    <svg
      className={className}
      width="1em"
      height="1em"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M11.0833 7.4346L5.54204 11.6667L0 7.43534L0.792582 6.83013L5.53526 10.4504L10.284 6.82351L11.0833 7.4346Z"
        fill="currentColor"
      />
      <path
        d="M11.0826 4.23133L10.1837 4.91596L5.54129 8.46339L0 4.23206L5.54204 0L11.0826 4.23133ZM5.54204 1.21769L1.59798 4.23206L5.54204 7.24782L9.4861 4.23206L5.54204 1.21769Z"
        fillRule="evenodd"
        clipRule="evenodd"
        fill="currentColor"
      />
    </svg>
  );
}
