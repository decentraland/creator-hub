import type { CSSProperties } from 'react';

/**
 * Minimal ANSI SGR parser for the debug console.
 *
 * Debug lines arrive over RPC from outside this frame. Parsing them into styled segments,
 * rather than accepting pre-rendered HTML, keeps the rendered output as React children — so
 * text stays text however the line is composed.
 *
 * Only the codes a scene preview actually emits are handled. Anything else is dropped, which
 * is the harmless direction: an unrecognised code costs colour, nothing more.
 */

/**
 * Derived from React's `CSSProperties` on purpose: a segment's style is spread straight into
 * a `style` prop, and picking from the real CSS type makes a non-CSS key (`bold`) impossible
 * to introduce — the spread is a rest object, so excess-property checking would not catch it.
 */
export type AnsiStyle = Pick<
  CSSProperties,
  'color' | 'backgroundColor' | 'fontWeight' | 'fontStyle' | 'textDecoration' | 'opacity'
>;

export type AnsiSegment = { text: string } & AnsiStyle;

type Style = AnsiStyle;

// xterm's first 16 colours. Indices 0-7 are codes 30-37/40-47, 8-15 the bright 90-97/100-107.
const BASE_COLORS = [
  '#000000',
  '#cd3131',
  '#0dbc79',
  '#e5e510',
  '#2472c8',
  '#bc3fbc',
  '#11a8cd',
  '#e5e5e5',
  '#666666',
  '#f14c4c',
  '#23d18b',
  '#f5f543',
  '#3b8eea',
  '#d670d6',
  '#29b8db',
  '#e5e5e5',
];

// eslint-disable-next-line no-control-regex
const SGR = /(?:\u001b\[|\u009b)([0-9;]*)m/g;

// `textDecoration` is one property but underline (4) and strikethrough (9) are independent
// codes, so each has to preserve the other rather than overwrite it.
const underlined = (style: Style) => String(style.textDecoration ?? '').includes('underline');
const struck = (style: Style) => String(style.textDecoration ?? '').includes('line-through');

/** Applies one SGR parameter list to `style`, mutating it. */
function applyCodes(codes: number[], style: Style) {
  for (const code of codes) {
    if (code === 0) {
      delete style.color;
      delete style.backgroundColor;
      delete style.fontWeight;
      delete style.fontStyle;
      delete style.textDecoration;
      delete style.opacity;
    } else if (code === 1) style.fontWeight = 'bold';
    else if (code === 2) style.opacity = 0.6;
    else if (code === 3) style.fontStyle = 'italic';
    else if (code === 4)
      style.textDecoration = struck(style) ? 'underline line-through' : 'underline';
    else if (code === 9)
      style.textDecoration = underlined(style) ? 'underline line-through' : 'line-through';
    else if (code === 22) {
      delete style.fontWeight;
      delete style.opacity;
    } else if (code === 23) delete style.fontStyle;
    else if (code === 24 || code === 29) delete style.textDecoration;
    else if (code >= 30 && code <= 37) style.color = BASE_COLORS[code - 30];
    else if (code === 39) delete style.color;
    else if (code >= 40 && code <= 47) style.backgroundColor = BASE_COLORS[code - 40];
    else if (code === 49) delete style.backgroundColor;
    else if (code >= 90 && code <= 97) style.color = BASE_COLORS[code - 90 + 8];
    else if (code >= 100 && code <= 107) style.backgroundColor = BASE_COLORS[code - 100 + 8];
  }
}

/**
 * Splits an ANSI-coloured line into styled segments.
 *
 * Escape sequences other than SGR are left in the text rather than interpreted; they
 * render as literal characters, which is harmless.
 */
export function parseAnsi(line: string): AnsiSegment[] {
  const segments: AnsiSegment[] = [];
  const style: Style = {};
  let cursor = 0;

  // `matchAll` rather than a loop over `SGR.exec`: it iterates from its own copy of the
  // regex, so the module-level `lastIndex` is never carried between calls.
  for (const match of line.matchAll(SGR)) {
    const index = match.index ?? 0;
    if (index > cursor) {
      segments.push({ text: line.slice(cursor, index), ...style });
    }
    // An empty parameter list (`[m`) means reset, i.e. code 0.
    const codes = match[1] === '' ? [0] : match[1].split(';').map(part => Number(part) || 0);
    applyCodes(codes, style);
    cursor = index + match[0].length;
  }

  if (cursor < line.length) {
    segments.push({ text: line.slice(cursor), ...style });
  }

  return segments;
}
