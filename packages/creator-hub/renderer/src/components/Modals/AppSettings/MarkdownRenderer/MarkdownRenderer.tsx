import React, { useMemo } from 'react';
import type { MarkdownToJSX } from 'markdown-to-jsx';
import Markdown from 'markdown-to-jsx';

import './MarkdownRenderer.css';

interface Props {
  content: string;
}

const MarkdownRenderer: React.FC<Props> = ({ content }) => {
  const options: MarkdownToJSX.Options = useMemo(
    () => ({
      disableParsingRawHTML: true, // Only allow standard markdown, no raw HTML
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
