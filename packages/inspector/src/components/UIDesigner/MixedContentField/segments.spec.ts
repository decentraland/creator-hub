import { describe, it, expect } from 'vitest';
import { SegmentKind } from '@dcl/asset-packs';
import { normalizeSegments, routeStorage, seedSegments, serializeNodes } from './segments';

function chip(variable: string): HTMLElement {
  const span = document.createElement('span');
  span.dataset.variable = variable;
  span.textContent = variable;
  return span;
}

function editorWith(...nodes: Array<string | HTMLElement>): HTMLElement {
  const root = document.createElement('div');
  for (const n of nodes) {
    root.appendChild(typeof n === 'string' ? document.createTextNode(n) : n);
  }
  return root;
}

describe('serializeNodes', () => {
  it('reads text nodes as literals and [data-variable] elements as bindings', () => {
    const root = editorWith('Hello ', chip('playerName'), ' welcome');
    expect(serializeNodes(root)).toEqual([
      { kind: SegmentKind.LITERAL, value: 'Hello ' },
      { kind: SegmentKind.BINDING, value: 'playerName' },
      { kind: SegmentKind.LITERAL, value: ' welcome' },
    ]);
  });
  it('ignores elements without data-variable', () => {
    const root = editorWith('a', document.createElement('br'), 'b');
    expect(serializeNodes(root)).toEqual([
      { kind: SegmentKind.LITERAL, value: 'a' },
      { kind: SegmentKind.LITERAL, value: 'b' },
    ]);
  });
  it('does not mint a binding for a data-variable that fails the identifier grammar', () => {
    // A foreign element (paste/drop) can carry an attacker-chosen data-variable.
    // It must be rejected at the read boundary rather than minted as a binding.
    const root = editorWith('a', chip('not a valid id; alert(1)'), 'b');
    expect(serializeNodes(root)).toEqual([
      { kind: SegmentKind.LITERAL, value: 'a' },
      { kind: SegmentKind.LITERAL, value: 'b' },
    ]);
  });
});

describe('normalizeSegments', () => {
  it('merges adjacent literals and drops empties', () => {
    expect(
      normalizeSegments([
        { kind: SegmentKind.LITERAL, value: 'a' },
        { kind: SegmentKind.LITERAL, value: '' },
        { kind: SegmentKind.LITERAL, value: 'b' },
        { kind: SegmentKind.BINDING, value: 'x' },
        { kind: SegmentKind.LITERAL, value: 'c' },
      ]),
    ).toEqual([
      { kind: SegmentKind.LITERAL, value: 'ab' },
      { kind: SegmentKind.BINDING, value: 'x' },
      { kind: SegmentKind.LITERAL, value: 'c' },
    ]);
  });
  it('returns an empty array for all-empty input', () => {
    expect(normalizeSegments([{ kind: SegmentKind.LITERAL, value: '' }])).toEqual([]);
  });
});

describe('routeStorage', () => {
  it('routes empty to a literal empty string', () => {
    expect(routeStorage([])).toEqual({ mode: 'literal', text: '' });
  });
  it('routes a single literal to literal', () => {
    expect(routeStorage([{ kind: SegmentKind.LITERAL, value: 'hi' }])).toEqual({
      mode: 'literal',
      text: 'hi',
    });
  });
  it('routes a single binding to single-bind', () => {
    expect(routeStorage([{ kind: SegmentKind.BINDING, value: 'name' }])).toEqual({
      mode: 'single-bind',
      variable: 'name',
    });
  });
  it('routes multiple segments to mixed', () => {
    const segs = [
      { kind: SegmentKind.LITERAL, value: 'Hi ' },
      { kind: SegmentKind.BINDING, value: 'name' },
    ];
    expect(routeStorage(segs)).toEqual({ mode: 'mixed', segments: segs });
  });
});

describe('seedSegments', () => {
  it('prefers an existing mixed entry', () => {
    const mixed = [{ kind: SegmentKind.LITERAL, value: 'm' }];
    expect(seedSegments('static', mixed, 'boundVar')).toBe(mixed);
  });
  it('falls back to a single binding chip', () => {
    expect(seedSegments('static', undefined, 'boundVar')).toEqual([
      { kind: SegmentKind.BINDING, value: 'boundVar' },
    ]);
  });
  it('falls back to a literal of the static value', () => {
    expect(seedSegments('static', undefined, undefined)).toEqual([
      { kind: SegmentKind.LITERAL, value: 'static' },
    ]);
  });
  it('returns empty for an empty static value', () => {
    expect(seedSegments('', undefined, undefined)).toEqual([]);
  });
});
