import type { CommonProps } from './types';

export function PublicIcon({ className }: CommonProps) {
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
        d="M12 1C5.928 1 1 5.928 1 12C1 18.072 5.928 23 12 23C18.072 23 23 18.072 23 12C23 5.928 18.072 1 12 1ZM10.9 20.723C6.555 20.184 3.2 16.488 3.2 12C3.2 11.318 3.288 10.669 3.431 10.031L8.7 15.3V16.4C8.7 17.61 9.69 18.6 10.9 18.6V20.723ZM18.49 17.929C18.204 17.038 17.39 16.4 16.4 16.4H15.3V13.1C15.3 12.495 14.805 12 14.2 12H7.6V9.8H9.8C10.405 9.8 10.9 9.305 10.9 8.7V6.5H13.1C14.31 6.5 15.3 5.51 15.3 4.3V3.849C18.523 5.158 20.8 8.315 20.8 12C20.8 14.288 19.92 16.367 18.49 17.929Z"
        fill="currentColor"
      />
    </svg>
  );
}
