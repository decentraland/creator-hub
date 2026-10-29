import type { CommonProps } from './types';

export function ScenesIcon({ className }: CommonProps) {
  return (
    <svg
      className={className}
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M22 14.745L12.5006 22L3 14.7463L4.35871 13.7088L12.489 19.9149L20.6297 13.6974L22 14.745Z"
        fill="currentColor"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M21.9987 9.2537L20.4577 10.4274L12.4994 16.5087L3 9.25496L12.5006 2L21.9987 9.2537ZM12.5006 4.08746L5.7394 9.25496L12.5006 14.4248L19.2619 9.25496L12.5006 4.08746Z"
        fill="currentColor"
      />
    </svg>
  );
}
