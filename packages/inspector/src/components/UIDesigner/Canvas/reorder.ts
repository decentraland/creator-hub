export type Box = { left: number; top: number; right: number; bottom: number };

export type Flow = {
  axis: 'x' | 'y';
  reversed: boolean;
  wrap: 'nowrap' | 'wrap' | 'wrap-reverse';
};

/** Read the flow off a parent's computed flexDirection/flexWrap. */
export function flowFrom(flexDirection: string, flexWrap: string): Flow {
  return {
    axis: flexDirection.startsWith('column') ? 'y' : 'x',
    reversed: flexDirection.endsWith('-reverse'),
    wrap: flexWrap === 'wrap' || flexWrap === 'wrap-reverse' ? flexWrap : 'nowrap',
  };
}

export type InsertionSlot = {
  index: number;
  main: number;
  crossStart: number;
  crossEnd: number;
};

type Span = { mainStart: number; mainEnd: number; crossStart: number; crossEnd: number };
type Extent = { start: number; end: number };

const project = (b: Box, axis: 'x' | 'y'): Span =>
  axis === 'x'
    ? { mainStart: b.left, mainEnd: b.right, crossStart: b.top, crossEnd: b.bottom }
    : { mainStart: b.top, mainEnd: b.bottom, crossStart: b.left, crossEnd: b.right };

function lineExtents(spans: Span[], reversed: boolean): Extent[] {
  const along = (s: Span) => (reversed ? -s.mainStart : s.mainStart);
  const lineOf: number[] = [];
  const extents: Extent[] = [];
  spans.forEach((s, i) => {
    const line = i === 0 ? 0 : lineOf[i - 1] + (along(s) > along(spans[i - 1]) ? 0 : 1);
    lineOf.push(line);
    const grown = extents[line];
    extents[line] = grown
      ? { start: Math.min(grown.start, s.crossStart), end: Math.max(grown.end, s.crossEnd) }
      : { start: s.crossStart, end: s.crossEnd };
  });
  return lineOf.map(line => extents[line]);
}

/** The insertion slot `point` falls into among `siblings` (in-flow, source order, dragged node excluded). */
export function insertionSlot(
  siblings: Box[],
  point: { x: number; y: number },
  flow: Flow,
  parent: Box,
): InsertionSlot {
  const main = flow.axis === 'x' ? point.x : point.y;
  const cross = flow.axis === 'x' ? point.y : point.x;
  const spans = siblings.map(b => project(b, flow.axis));
  const parentSpan = project(parent, flow.axis);
  const lines = flow.wrap === 'nowrap' ? null : lineExtents(spans, flow.reversed);

  const line = (i: number): number => {
    if (!lines) return 0;
    const { start, end } = lines[i];
    if (flow.wrap === 'wrap-reverse') return start > cross ? -1 : end < cross ? 1 : 0;
    return end < cross ? -1 : start > cross ? 1 : 0;
  };
  const passed = (s: Span): boolean => {
    const mid = (s.mainStart + s.mainEnd) / 2;
    return flow.reversed ? main < mid : main > mid;
  };

  let index = 0;
  spans.forEach((s, i) => {
    const rel = line(i);
    if (rel < 0 || (rel === 0 && passed(s))) index += 1;
  });

  const before = index > 0 ? index - 1 : null;
  const after = index < spans.length ? index : null;
  const lead = (s: Span) => (flow.reversed ? s.mainEnd : s.mainStart);
  const trail = (s: Span) => (flow.reversed ? s.mainStart : s.mainEnd);
  const useAfter =
    after !== null && (line(after) === 0 || !(before !== null && line(before) === 0));
  const anchor = useAfter ? after : before;

  let markerMain: number;
  if (before !== null && after !== null && line(before) === line(after)) {
    markerMain = (trail(spans[before]) + lead(spans[after])) / 2;
  } else if (anchor !== null) {
    markerMain = useAfter ? lead(spans[anchor]) : trail(spans[anchor]);
  } else {
    markerMain = lead(parentSpan);
  }

  const extent = lines && anchor !== null ? lines[anchor] : null;
  return {
    index,
    main: markerMain,
    crossStart: extent ? extent.start : parentSpan.crossStart,
    crossEnd: extent ? extent.end : parentSpan.crossEnd,
  };
}
