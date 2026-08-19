import React from 'react';

/**
 * Render the inline markup `PBUiText.value` supports — `<b>` and `<i>`, and only
 * those (see `@dcl/ecs` ui_text.gen.d.ts: "the text content, tag <b> and <i> are
 * supported"). Without this the canvas paints the tags as literal characters and
 * disagrees with what the explorer ships.
 *
 * Builds React elements rather than setting innerHTML. The value is
 * author-controlled and reaches the DOM verbatim, so the escape React gives a
 * text child is the whole safety story here; anything we don't recognise stays
 * text, including `<script>`.
 *
 * A malformed tag renders LITERALLY — an unclosed `<b>`, a stray `</b>`, an
 * unsupported `<color=…>`. Dropping it would leave the author with text that
 * silently isn't bold and no hint why.
 */
const TAGS = new Set(['b', 'i']);

// `<b>` / `</b>` / `<i>` / `</i>`, lowercase only — matching the SDK's own
// documentation. A `<B>` is therefore "unsupported" and shows through, which is
// the honest answer when we don't know that the explorer accepts it.
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
      // A close with no matching open — not ours to consume.
      literal += tag;
      i = lt + tag.length;
      continue;
    }
    const inner = parseRun(src, lt + tag.length, name);
    if (inner.closed) {
      flush();
      nodes.push(React.createElement(name, { key: nodes.length }, ...inner.nodes));
    } else {
      // Never closed: show the opening tag as text and keep the content it
      // wrapped, already parsed, in place.
      literal += tag;
      flush();
      nodes.push(...inner.nodes);
    }
    i = inner.next;
  }

  flush();
  return { nodes, next: i, closed: false };
}

export function renderTextMarkup(text: string): React.ReactNode {
  // The overwhelmingly common case: no markup at all. Hand back the string so
  // the canvas renders exactly the node it always did.
  if (!text.includes('<')) return text;
  const { nodes } = parseRun(text, 0, null);
  if (nodes.length === 1 && typeof nodes[0] === 'string') return nodes[0];
  return nodes;
}
