import type { ReactNode } from 'react';

import { misc } from '#preload';

type Props = {
  href: string;
  className?: string;
  children: ReactNode;
};

/** A real `<a>` whose click opens the URL in the system browser. */
export function ExternalLink({ href, className, children }: Props) {
  return (
    <a
      href={href}
      className={className}
      onClick={event => {
        event.preventDefault();
        void misc.openExternal(href);
      }}
    >
      {children}
    </a>
  );
}
