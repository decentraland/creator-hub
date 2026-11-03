import React from 'react';

import { parseAnsi } from '../../lib/logic/ansi';

/**
 * One preview log line, rendered as styled spans.
 *
 * Shared with the Creator Hub's detached console window through `dist/ansi-entrypoint.js`, so
 * both consoles turn untrusted log text into React children the same way.
 *
 * Memoized: entries are immutable and keyed by id, so each line is parsed once while it stays
 * mounted instead of on every render of a console holding up to a thousand of them. The outer
 * span is what each console's `> span` rule styles as a block, so it has to stay a single
 * element.
 */
export const AnsiLine = React.memo(function AnsiLine({ text }: { text: string }) {
  return (
    <span>
      {parseAnsi(text).map((segment, index) => {
        const { text: content, ...style } = segment;
        return (
          <span
            key={index}
            style={style}
          >
            {content}
          </span>
        );
      })}
    </span>
  );
});
