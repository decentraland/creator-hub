// Geometry for canvas drag-to-reorder: dragging an in-flow node picks a new slot
// among its siblings (the source order is then spliced) instead of writing an
// offset. Kept DOM-free — plain boxes in viewport px — so the hit test is
// unit-testable without a layout engine.

export type Box = { left: number; top: number; right: number; bottom: number };

export type Flow = {
  // Main axis of the parent's flex flow.
  axis: 'x' | 'y';
  // `*-reverse` direction: flow order runs against the axis.
  reversed: boolean;
  wrap: 'nowrap' | 'wrap' | 'wrap-reverse';
};

// Read the flow off a parent's computed flexDirection/flexWrap. Computed values
// are the truth here: the canvas renders the node's PB UiTransform as real CSS,
// so whatever the browser laid out is what the user sees and drops onto.
export function flowFrom(flexDirection: string, flexWrap: string): Flow {
  return {
    axis: flexDirection.startsWith('column') ? 'y' : 'x',
    reversed: flexDirection.endsWith('-reverse'),
    wrap: flexWrap === 'wrap' || flexWrap === 'wrap-reverse' ? flexWrap : 'nowrap',
  };
}

export type InsertionSlot = {
  // Where the dragged node would land, as an index into the sibling gaps
  // (0..siblings.length) in SOURCE order — `siblings` excludes the dragged node.
  index: number;
  // Insertion indicator: offset along the main axis and extent along the cross
  // axis, in the same viewport px as the boxes passed in.
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

// Cross extent of the flex LINE each sibling belongs to. Flex lays items out in
// source order along the main axis and resets to the line start on a wrap, so a
// main position that fails to advance marks a new line. The grouping is what
// makes this correct: a line's items can differ in cross size (any align-items
// but `stretch`), and measured against its own box alone a short item would read
// as a line of its own.
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

// The slot `point` (the dragged node's live center) falls into among `siblings`
// (in-flow, source order, dragged node excluded). Flex lays wrapped lines out in
// source order, so counting the siblings the point has passed — earlier lines
// whole, the point's own line by midpoint — yields a source-order index directly.
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
  // A nowrap container is a single line by definition, so its cross axis carries
  // no ordering at all — reading it would reorder on a purely sideways drag.
  const lines = flow.wrap === 'nowrap' ? null : lineExtents(spans, flow.reversed);

  // Which line a sibling sits on relative to the point: -1 earlier, 0 the same,
  // 1 later. A point in the gap between two lines resolves to neither, which
  // still orders it after every earlier line and before every later one.
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
  // Anchor the indicator to the neighbour on the point's own line, so a slot that
  // straddles a wrap (end of one line == start of the next) draws where the drag
  // is instead of jumping to the other line.
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

  // Span the anchored line only when wrapping — a full-parent bar would cross
  // every line. A single-line container keeps the full-height divider look.
  const extent = lines && anchor !== null ? lines[anchor] : null;
  return {
    index,
    main: markerMain,
    crossStart: extent ? extent.start : parentSpan.crossStart,
    crossEnd: extent ? extent.end : parentSpan.crossEnd,
  };
}
