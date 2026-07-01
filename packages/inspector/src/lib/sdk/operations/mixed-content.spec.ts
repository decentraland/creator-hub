import { describe, expect, it } from 'vitest';
import type { Entity, IEngine } from '@dcl/ecs';
import { ComponentName, SegmentKind } from '@dcl/asset-packs';

import { setMixedContent } from './set-mixed-content';
import { renameVariable } from './rename-variable';
import { deleteVariable } from './delete-variable';

type Seg = { kind: SegmentKind; value: string };
type Row = { field: string; variable: string; segments?: Seg[] };
const lit = (value: string): Seg => ({ kind: SegmentKind.LITERAL, value });
const bind = (value: string): Seg => ({ kind: SegmentKind.BINDING, value });

function makeComponent<T>(initial: Array<[Entity, T]> = []) {
  const store = new Map<Entity, T>(initial);
  return {
    store,
    getOrNull: (e: Entity) => store.get(e) ?? null,
    createOrReplace: (e: Entity, v: T) => {
      store.set(e, v);
    },
    has: (e: Entity) => store.has(e),
  };
}

function makeEngine(opts: {
  ui?: ReturnType<typeof makeComponent> | null;
  bindings?: ReturnType<typeof makeComponent> | null;
  uiTransform?: Array<[Entity, { parent?: number }]>;
}): IEngine {
  const uiTransformToken = { __id: 'core::UiTransform' };
  const byName: Record<string, unknown> = {
    [ComponentName.UI]: opts.ui ?? null,
    [ComponentName.UI_BINDINGS]: opts.bindings ?? null,
    'core::UiTransform': uiTransformToken,
  };
  return {
    getComponent: (id: string) => byName[id],
    getComponentOrNull: (id: string) => byName[id] ?? null,
    getEntitiesWith: (token: unknown) =>
      token === uiTransformToken ? (opts.uiTransform ?? []) : [],
  } as unknown as IEngine;
}

describe('setMixedContent', () => {
  it('writes a mixed row (variable: "", segments) for the field', () => {
    const bindings = makeComponent<{ value: Row[] }>();
    const engine = makeEngine({ bindings });
    setMixedContent(engine)(5 as Entity, 'core::UiText.value', [lit('Hello '), bind('playerName')]);
    expect(bindings.store.get(5 as Entity)).toEqual({
      value: [
        {
          field: 'core::UiText.value',
          variable: '',
          segments: [
            { kind: SegmentKind.LITERAL, value: 'Hello ' },
            { kind: SegmentKind.BINDING, value: 'playerName' },
          ],
        },
      ],
    });
  });

  it('replaces any existing row for the same field, preserving others', () => {
    const bindings = makeComponent<{ value: Row[] }>([
      [
        5 as Entity,
        {
          value: [
            { field: 'core::UiText.value', variable: 'old' },
            { field: 'core::UiInput.value', variable: 'keep' },
          ],
        },
      ],
    ]);
    const engine = makeEngine({ bindings });
    setMixedContent(engine)(5 as Entity, 'core::UiText.value', [lit('x'), bind('y')]);
    expect(bindings.store.get(5 as Entity)).toEqual({
      value: [
        { field: 'core::UiInput.value', variable: 'keep' },
        {
          field: 'core::UiText.value',
          variable: '',
          segments: [
            { kind: SegmentKind.LITERAL, value: 'x' },
            { kind: SegmentKind.BINDING, value: 'y' },
          ],
        },
      ],
    });
  });

  it('throws on an invalid field path', () => {
    const engine = makeEngine({ bindings: makeComponent() });
    expect(() => setMixedContent(engine)(5 as Entity, 'not a path', [])).toThrow();
  });

  it('throws on an invalid binding-segment identifier', () => {
    const engine = makeEngine({ bindings: makeComponent() });
    expect(() =>
      setMixedContent(engine)(5 as Entity, 'core::UiText.value', [bind('1 bad name')]),
    ).toThrow();
  });
});

describe('renameVariable cascade', () => {
  it('renames both single-bind variables and binding segments', () => {
    const ui = makeComponent([
      [
        1 as Entity,
        {
          name: 'HUD',
          visible: true,
          variables: [{ name: 'old', type: 'string', defaultValue: '' }],
        },
      ],
    ]);
    const bindings = makeComponent<{ value: Row[] }>([
      [
        2 as Entity,
        {
          value: [
            { field: 'core::UiInput.value', variable: 'old' },
            { field: 'core::UiText.value', variable: '', segments: [lit('Hi '), bind('old')] },
          ],
        },
      ],
    ]);
    const engine = makeEngine({ ui, bindings, uiTransform: [[2 as Entity, { parent: 1 }]] });
    renameVariable(engine)(1 as Entity, 'old', 'new');
    expect(bindings.store.get(2 as Entity)).toEqual({
      value: [
        { field: 'core::UiInput.value', variable: 'new' },
        {
          field: 'core::UiText.value',
          variable: '',
          segments: [
            { kind: SegmentKind.LITERAL, value: 'Hi ' },
            { kind: SegmentKind.BINDING, value: 'new' },
          ],
        },
      ],
    });
  });
});

describe('deleteVariable cascade', () => {
  it('drops single-bind rows, strips segments, and drops emptied segment-rows', () => {
    const ui = makeComponent([
      [
        1 as Entity,
        {
          name: 'HUD',
          visible: true,
          variables: [{ name: 'gone', type: 'string', defaultValue: '' }],
        },
      ],
    ]);
    const bindings = makeComponent<{ value: Row[] }>([
      [
        2 as Entity,
        {
          value: [
            { field: 'core::UiInput.value', variable: 'gone' },
            { field: 'core::UiText.value', variable: '', segments: [lit('Hi '), bind('gone')] },
            { field: 'core::UiText.placeholder', variable: '', segments: [bind('gone')] },
          ],
        },
      ],
    ]);
    const engine = makeEngine({ ui, bindings, uiTransform: [[2 as Entity, { parent: 1 }]] });
    deleteVariable(engine)(1 as Entity, 'gone');
    expect(bindings.store.get(2 as Entity)).toEqual({
      value: [
        {
          field: 'core::UiText.value',
          variable: '',
          segments: [{ kind: SegmentKind.LITERAL, value: 'Hi ' }],
        },
      ],
    });
  });
});
