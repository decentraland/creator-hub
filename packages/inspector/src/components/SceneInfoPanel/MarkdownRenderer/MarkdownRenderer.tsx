import React, { useMemo } from 'react';
import Markdown from 'markdown-to-jsx';

import { isExternalUrl } from '../utils';
import { AssetImage } from './AssetImage';
import { AssetVideo } from './AssetVideo';
import { AssetIframe } from './AssetIframe';

import './MarkdownRenderer.css';

interface Props {
  content: string;
}

const MarkdownRenderer: React.FC<Props> = ({ content }) => {
  const options = useMemo(
    () => ({
      overrides: {
        // Custom components with dataLayer loading for relative paths
        img: { component: AssetImage },
        video: { component: AssetVideo },
        iframe: { component: AssetIframe },

        // Custom link to open in new tab for external links
        a: {
          component: ({ href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
            const isExternal = href && isExternalUrl(href);
            return (
              <a
                href={href}
                {...props}
                {...(isExternal && { target: '_blank', rel: 'noopener noreferrer' })}
              />
            );
          },
        },
      },
    }),
    [],
  );

  return (
    <div className="MarkdownRenderer">
      <Markdown options={options}>{content}</Markdown>
    </div>
  );
};

export default React.memo(MarkdownRenderer);
