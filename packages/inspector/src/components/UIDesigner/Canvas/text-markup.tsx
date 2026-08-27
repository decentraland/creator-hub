import React from 'react';

const TAGS = new Set(['b', 'i']);

const TAG = /^<(\/?)([bi])>/;

interface Run {
  nodes: React.ReactNode[];
  next: number;
  closed: boolean;
}

function parseRun(src: string, start: number, closeTag: string | null): Run {
  const nodes: React.ReactNode[] = [];
  let literal = '';
  let i = start;

  const flush = () => {
    if (literal) nodes.push(literal);
    literal = '';
  };

  while (i < src.length) {
    const lt = src.indexOf('<', i);
    if (lt === -1) {
      literal += src.slice(i);
      i = src.length;
      break;
    }
    literal += src.slice(i, lt);
    const match = TAG.exec(src.slice(lt));
    if (!match || !TAGS.has(match[2])) {
      literal += '<';
      i = lt + 1;
      continue;
    }
    const [tag, slash, name] = [match[0], match[1], match[2]];
    if (slash) {
      if (name === closeTag) {
        flush();
        return { nodes, next: lt + tag.length, closed: true };
      }
      literal += tag;
      i = lt + tag.length;
      continue;
    }
    const inner = parseRun(src, lt + tag.length, name);
    if (inner.closed) {
      flush();
      nodes.push(React.createElement(name, { key: nodes.length }, ...inner.nodes));
    } else {
      literal += tag;
      flush();
      nodes.push(...inner.nodes);
    }
    i = inner.next;
  }

  flush();
  return { nodes, next: i, closed: false };
}

/** Render the inline markup `PBUiText.value` supports (`<b>` and `<i>`) as React elements. */
export function renderTextMarkup(text: string): React.ReactNode {
  if (!text.includes('<')) return text;
  const { nodes } = parseRun(text, 0, null);
  if (nodes.length === 1 && typeof nodes[0] === 'string') return nodes[0];
  return nodes;
}
