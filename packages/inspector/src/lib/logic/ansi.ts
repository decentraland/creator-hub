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

export type AnsiSegment = {
  text: string;
  color?: string;
  backgroundColor?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
};

type Style = Omit<AnsiSegment, 'text'>;

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

/** Resolves a 256-colour index to a hex string, per the xterm cube + greyscale ramp. */
function color256(index: number): string | undefined {
  if (!Number.isFinite(index) || index < 0) return undefined;
  if (index < 16) return BASE_COLORS[index];
  if (index < 232) {
    const level = (n: number) => (n === 0 ? 0 : 55 + n * 40);
    const offset = index - 16;
    return rgb(
      level(Math.floor(offset / 36) % 6),
      level(Math.floor(offset / 6) % 6),
      level(offset % 6),
    );
  }
  if (index < 256) {
    const grey = 8 + (index - 232) * 10;
    return rgb(grey, grey, grey);
  }
  return undefined;
}

function rgb(r: number, g: number, b: number) {
  // A truncated sequence (`38;2;12` with no green/blue) yields NaN; drop the colour
  // rather than emitting `#NaNNaNNaN`.
  if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) return undefined;
  const hex = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

/**
 * Applies one SGR parameter list to `style`, mutating it.
 *
 * Returns nothing: extended forms (`38;5;n`, `38;2;r;g;b`) consume following parameters,
 * so the loop index is owned here rather than by the caller.
 */
function applyCodes(codes: number[], style: Style) {
  for (let i = 0; i < codes.length; i++) {
    const code = codes[i];

    // Extended colour: `38`/`48` then a selector, then its arguments.
    if (code === 38 || code === 48) {
      const key = code === 38 ? 'color' : 'backgroundColor';
      const selector = codes[i + 1];
      if (selector === 5) {
        style[key] = color256(codes[i + 2]);
        i += 2;
      } else if (selector === 2) {
        style[key] = rgb(codes[i + 2], codes[i + 3], codes[i + 4]);
        i += 4;
      }
      continue;
    }

    if (code === 0) {
      delete style.color;
      delete style.backgroundColor;
      delete style.bold;
      delete style.italic;
      delete style.underline;
    } else if (code === 1) style.bold = true;
    else if (code === 3) style.italic = true;
    else if (code === 4) style.underline = true;
    else if (code === 22) delete style.bold;
    else if (code === 23) delete style.italic;
    else if (code === 24) delete style.underline;
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
