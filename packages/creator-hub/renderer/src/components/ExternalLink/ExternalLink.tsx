import type { ReactNode } from 'react';

import { misc } from '#preload';

type Props = {
  href: string;
  className?: string;
  children: ReactNode;
  onOpen?: () => void;
};

/** A real `<a>` whose click opens the URL in the system browser, then calls `onOpen`. */
export function ExternalLink({ href, className, children, onOpen }: Props) {
  return (
    <a
      href={href}
      className={className}
      onClick={event => {
        event.preventDefault();
        void misc.openExternal(href);
        onOpen?.();
      }}
    >
      {children}
    </a>
  );
}
