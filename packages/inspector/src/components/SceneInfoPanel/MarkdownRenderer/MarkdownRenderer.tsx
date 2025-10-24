import React, { useMemo } from 'react';
import type { MarkdownToJSX } from 'markdown-to-jsx';
import Markdown from 'markdown-to-jsx';

import { AssetImage } from './AssetImage';
import { AssetVideo } from './AssetVideo';
import { AssetLink } from './AssetLink';
import { AssetIframe } from './AssetIframe';

import './MarkdownRenderer.css';

interface Props {
  content: string;
}

const MarkdownRenderer: React.FC<Props> = ({ content }) => {
  const options: MarkdownToJSX.Options = useMemo(
    () => ({
      sanitizer(value, tag, attribute) {
        // Sanitize URLs in specific tags and attributes
        if (
          (tag === 'a' && attribute === 'href') ||
          (tag === 'img' && attribute === 'src') ||
          (tag === 'video' && attribute === 'src') ||
          (tag === 'iframe' && attribute === 'src')
        ) {
          try {
            if (!value) return ''; // Empty value
            const url = new URL(value);
            if (url.protocol !== 'https:') return ''; // Only allow https for external content
            return url.href; // Valid https URL
          } catch {
            return `${value}`; // Source is not an URL, return the original string value as it will be handled as a local scene file.
          }
        } else if (tag === 'script') {
          return ''; // Disallow script tags entirely
        } else {
          return value; // For all other tags/attributes, return the value as is
        }
      },
      overrides: {
        // Custom components that handle both external URLs and local scene file paths
        img: { component: AssetImage },
        video: { component: AssetVideo },
        iframe: { component: AssetIframe },
        a: { component: AssetLink },
        script: { component: () => null }, // Disallow scripts for security reasons
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
