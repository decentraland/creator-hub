import { describe, expect, it, afterEach } from 'vitest';
import { cleanup, render } from '@testing-library/react';

import { renderTextMarkup } from './text-markup';

afterEach(() => {
  cleanup();
});

// Asserted on the DOM tree, not innerHTML: happy-dom's serializer does not escape
// `<` in text nodes, so innerHTML cannot tell "the characters &lt;b&gt;" from "a
// <b> element" — which is the entire distinction under test. `[b]…[/b]` marks a
// real element; everything else is a text node, verbatim.
const shape = (node: Node): string => {
  if (node.nodeType === 3) return node.textContent ?? '';
  const tag = node.nodeName.toLowerCase();
  const inner = [...node.childNodes].map(shape).join('');
  return `[${tag}]${inner}[/${tag}]`;
};

const render_ = (text: string) => {
  const { container } = render(<span>{renderTextMarkup(text)}</span>);
  return [...container.firstElementChild!.childNodes].map(shape).join('');
};

describe('when the text carries no markup', () => {
  it('should render it unchanged', () => {
    expect(render_('Just text')).toBe('Just text');
  });

  it('should return the string itself so the common path allocates nothing', () => {
    expect(renderTextMarkup('Just text')).toBe('Just text');
  });
});

describe('when the text carries the tags the SDK supports', () => {
  it('should render bold', () => {
    expect(render_('a <b>bold</b> b')).toBe('a [b]bold[/b] b');
  });

  it('should render italic', () => {
    expect(render_('a <i>slanted</i> b')).toBe('a [i]slanted[/i] b');
  });

  it('should nest them', () => {
    expect(render_('<b>bold <i>and slanted</i></b>')).toBe('[b]bold [i]and slanted[/i][/b]');
  });

  it('should render several runs', () => {
    expect(render_('<b>one</b> and <b>two</b>')).toBe('[b]one[/b] and [b]two[/b]');
  });
});

// Swallowing a broken tag would leave the author staring at missing text with no
// clue why; showing it back is how they see the typo.
describe('when a tag is malformed', () => {
  it('should show an unclosed tag literally, keeping the text it wrapped', () => {
    expect(render_('<b>never closed')).toBe('<b>never closed');
  });

  it('should show a stray closing tag literally', () => {
    expect(render_('nope</b> ok')).toBe('nope</b> ok');
  });

  it('should still format a well-formed run after a broken one', () => {
    expect(render_('</b> then <i>ok</i>')).toBe('</b> then [i]ok[/i]');
  });

  it('should show a tag the SDK does not support literally', () => {
    expect(render_('<color=red>x</color>')).toBe('<color=red>x</color>');
  });

  it('should leave a bare angle bracket alone', () => {
    expect(render_('2 < 3 > 1')).toBe('2 < 3 > 1');
  });
});

// The value is author-controlled and reaches the DOM verbatim, so anything we do
// not recognise must stay a TEXT node — never become an element.
describe('when the text contains markup we do not render', () => {
  it('should not turn an img/onerror payload into an element', () => {
    const { container } = render(<span>{renderTextMarkup('<img src=x onerror=alert(1)>')}</span>);

    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toBe('<img src=x onerror=alert(1)>');
  });

  it('should keep a script tag inside a bold run as text', () => {
    const { container } = render(
      <span>{renderTextMarkup('<b><script>alert(1)</script></b>')}</span>,
    );

    expect(container.querySelector('script')).toBeNull();
    expect(render_('<b><script>alert(1)</script></b>')).toBe('[b]<script>alert(1)</script>[/b]');
  });
});
