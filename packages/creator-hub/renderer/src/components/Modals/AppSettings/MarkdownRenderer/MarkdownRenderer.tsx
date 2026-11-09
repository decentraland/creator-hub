import React, { useMemo } from 'react';
import type { MarkdownToJSX } from 'markdown-to-jsx';
import Markdown from 'markdown-to-jsx';

import './MarkdownRenderer.css';

interface Props {
  content: string;
  overrides?: MarkdownToJSX.Overrides;
}

const MarkdownRenderer: React.FC<Props> = ({ content, overrides }) => {
  const options: MarkdownToJSX.Options = useMemo(
    () => ({ disableParsingRawHTML: true, overrides }),
    [overrides],
  );

  return (
    <div className="MarkdownRenderer">
      <Markdown options={options}>{content}</Markdown>
    </div>
  );
};

export default React.memo(MarkdownRenderer);
