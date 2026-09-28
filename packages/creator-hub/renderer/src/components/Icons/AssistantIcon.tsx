import { useId } from 'react';

import type { CommonProps } from './types';

// The AI Assistant sparkle mark (three four-point stars). `gradient` paints it with the
// gold→purple brand gradient (used for the active/open state); otherwise it inherits the
// current text color so a plain white variant just works.
const PATH =
  'M17.9509 16.5078C18.1294 16.115 18.6874 16.115 18.8659 16.5078L19.4821 17.8633C19.5324 17.9739 19.6215 18.063 19.7321 18.1133L21.0876 18.7295C21.4802 18.9082 21.4803 19.466 21.0876 19.6445L19.7321 20.2607C19.6215 20.311 19.5324 20.3992 19.4821 20.5098L18.8659 21.8652C18.6874 22.258 18.1294 22.258 17.9509 21.8652L17.3347 20.5098C17.2844 20.3992 17.1953 20.311 17.0847 20.2607L15.7292 19.6445C15.3365 19.466 15.3367 18.9082 15.7292 18.7295L17.0847 18.1133C17.1953 18.063 17.2844 17.9739 17.3347 17.8633L17.9509 16.5078ZM7.85421 6.10155C8.13829 5.47724 9.02515 5.47729 9.30928 6.10155L10.7126 9.18847C10.7926 9.36414 10.9334 9.50504 11.1091 9.58495L14.195 10.9873C14.8198 11.2713 14.8198 12.1594 14.195 12.4434L11.1091 13.8457C10.9332 13.9257 10.7926 14.0673 10.7126 14.2432L9.30928 17.3291C9.02518 17.9535 8.13825 17.9536 7.85421 17.3291L6.45089 14.2432C6.37091 14.0672 6.23035 13.9257 6.0544 13.8457L2.96846 12.4434C2.34368 12.1594 2.34368 11.2713 2.96846 10.9873L6.0544 9.58495C6.23016 9.50506 6.37086 9.36415 6.45089 9.18847L7.85421 6.10155ZM17.9528 1.79491C18.1314 1.4021 18.6893 1.4021 18.8679 1.79491L19.4841 3.15038C19.5344 3.261 19.6235 3.3501 19.7341 3.40038L21.0896 4.01659C21.4821 4.19528 21.4823 4.75312 21.0896 4.93163L19.7341 5.54784C19.6235 5.59811 19.5344 5.68628 19.4841 5.79687L18.8679 7.15234C18.6893 7.54515 18.1314 7.54515 17.9528 7.15234L17.3366 5.79687C17.2863 5.68629 17.1972 5.59811 17.0866 5.54784L15.7312 4.93163C15.3384 4.75313 15.3386 4.19529 15.7312 4.01659L17.0866 3.40038C17.1973 3.3501 17.2863 3.261 17.3366 3.15038L17.9528 1.79491Z';

export function AssistantIcon({ className, gradient }: CommonProps & { gradient?: boolean }) {
  // Unique per instance so a second gradient icon can't collide on the SVG id.
  const gradientId = useId();
  return (
    <svg
      className={className}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d={PATH}
        fill={gradient ? `url(#${gradientId})` : 'currentColor'}
      />
      {gradient && (
        <defs>
          <linearGradient
            id={gradientId}
            x1="6.9999"
            y1="4.00031"
            x2="21.1896"
            y2="20.763"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#FFD079" />
            <stop
              offset="1"
              stopColor="#DA36FF"
            />
          </linearGradient>
        </defs>
      )}
    </svg>
  );
}
