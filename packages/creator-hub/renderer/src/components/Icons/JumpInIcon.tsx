import type { CommonProps } from './types';

export function JumpInIcon({ className }: CommonProps) {
  return (
    <svg
      className={className}
      width="1em"
      height="1em"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        width="20"
        height="20"
        rx="6"
        fill="currentColor"
      />
      <path
        d="M16.7111 9.06505L12.034 4.39027C11.2002 3.55695 9.79711 4.14637 9.79711 5.32523V6.86994C9.75644 6.86994 9.73611 6.86994 9.69544 6.86994H5.25895C4.50654 6.86994 3.89648 7.45936 3.89648 8.21139V11.7683C3.89648 12.5203 4.50654 13.1301 5.25895 13.1301H9.6751C9.71577 13.1301 9.73611 13.1301 9.77678 13.1301V14.6748C9.77678 15.8536 11.2002 16.4431 12.0137 15.6097L16.6908 10.935C17.2195 10.4065 17.2195 9.57317 16.7111 9.06505Z"
        fill="#FCFCFC"
      />
    </svg>
  );
}
