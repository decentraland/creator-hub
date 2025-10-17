import React, { useMemo } from 'react';
import Markdown from 'markdown-to-jsx';

import { AssetImage } from './AssetImage';
import { AssetVideo } from './AssetVideo';
import { AssetIframe } from './AssetIframe';
import { AssetLink } from './AssetLink';

import './MarkdownRenderer.css';

interface Props {
  content: string;
}

const MarkdownRenderer: React.FC<Props> = ({ content }) => {
  const options = useMemo(
    () => ({
      overrides: {
        // Custom components that handle both external URLs and local scene file paths
        img: { component: AssetImage },
        video: { component: AssetVideo },
        iframe: { component: AssetIframe },
        a: { component: AssetLink },
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
