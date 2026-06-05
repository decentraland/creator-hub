import { describe, expect, it } from 'vitest';
import type { Entity, IEngine } from '@dcl/ecs';

import { buildUINodeTree, previewBoundText } from './tree-model';

interface MockComponent {
  store: Map<Entity, any>;
  has(entity: Entity): boolean;
  getOrNull(entity: Entity): any | null;
  iterator(): IterableIterator<[Entity, any]>;
}

function makeComponent(initial: Array<[Entity, any]> = []): MockComponent {
  const store = new Map<Entity, any>(initial);
  return {
    store,
    has: (entity: Entity) => store.has(entity),
    getOrNull: (entity: Entity) => store.get(entity) ?? null,
    iterator: () => store.entries(),
  };
}

function makeEngine(componentMap: Record<string, MockComponent>): IEngine {
  return {
    getComponentOrNull: (id: string | number) => componentMap[id as string] ?? null,
    getComponent: (id: string | number) => {
      const c = componentMap[id as string];
      if (!c) throw new Error(`Component ${String(id)} not defined`);
      return c;
    },
  } as unknown as IEngine;
}

describe('buildUINodeTree', () => {
  describe('when the engine has no UiTransform component', () => {
    it('should return null', () => {
      const engine = makeEngine({});
      expect(buildUINodeTree(engine, 1 as Entity)).toBeNull();
    });
  });

  describe('when the root entity does not have UiTransform', () => {
    it('should return null', () => {
      const UiTransform = makeComponent();
      const engine = makeEngine({ 'core::UiTransform': UiTransform });
      expect(buildUINodeTree(engine, 1 as Entity)).toBeNull();
    });
  });

  describe('when three entities are chained via UiTransform.parent', () => {
    it('should build a three-level tree rooted at the given entity', () => {
      const root = 10 as Entity;
      const mid = 11 as Entity;
      const leaf = 12 as Entity;
      const UiTransform = makeComponent([
        [root, { parent: undefined }],
        [mid, { parent: root }],
        [leaf, { parent: mid }],
      ]);
      const engine = makeEngine({ 'core::UiTransform': UiTransform });

      const tree = buildUINodeTree(engine, root);

      expect(tree).not.toBeNull();
      expect(tree!.entity).toBe(root);
      expect(tree!.type).toBe('UiEntity');
      expect(tree!.children).toHaveLength(1);
      expect(tree!.children[0].entity).toBe(mid);
      expect(tree!.children[0].children).toHaveLength(1);
      expect(tree!.children[0].children[0].entity).toBe(leaf);
      expect(tree!.children[0].children[0].children).toHaveLength(0);
    });
  });

  describe('when an entity carries UiText', () => {
    it('should classify it as a Label', () => {
      const root = 1 as Entity;
      const child = 2 as Entity;
      const UiTransform = makeComponent([
        [root, { parent: undefined }],
        [child, { parent: root }],
      ]);
      const UiText = makeComponent([[child, { value: 'hello' }]]);
      const engine = makeEngine({
        'core::UiTransform': UiTransform,
        'core::UiText': UiText,
      });

      const tree = buildUINodeTree(engine, root);
      expect(tree!.children[0].type).toBe('Label');
      expect(tree!.children[0].uiText).toEqual({ value: 'hello' });
    });
  });

  describe('when an entity has a Name component', () => {
    it('should use the name value as the node label', () => {
      const root = 5 as Entity;
      const UiTransform = makeComponent([[root, { parent: undefined }]]);
      const Name = makeComponent([[root, { value: 'MainHUD' }]]);
      const engine = makeEngine({
        'core::UiTransform': UiTransform,
        'core-schema::Name': Name,
      });

      const tree = buildUINodeTree(engine, root);
      expect(tree!.name).toBe('MainHUD');
    });
  });

  describe('when a cycle exists between two entities', () => {
    it('should not infinitely recurse', () => {
      const a = 1 as Entity;
      const b = 2 as Entity;
      const UiTransform = makeComponent([
        [a, { parent: b }],
        [b, { parent: a }],
      ]);
      const engine = makeEngine({ 'core::UiTransform': UiTransform });

      const tree = buildUINodeTree(engine, a);
      expect(tree).not.toBeNull();
      // No infinite recursion — the visited set short-circuits.
    });
  });
});

describe('previewBoundText', () => {
  const KEY = 'core::UiText.value';

  it('returns the static value when the field has no binding row', () => {
    expect(previewBoundText(undefined, KEY, 'Label')).toBe('Label');
    expect(previewBoundText([{ field: 'other', variable: 'x' }], KEY, 'Label')).toBe('Label');
  });

  it('composes mixed-content segments with [name] placeholders for bindings', () => {
    const bindings = [
      {
        field: KEY,
        variable: '',
        segments: [
          { kind: 'literal', value: 'Hola ' },
          { kind: 'binding', value: 'inputValue' },
          { kind: 'literal', value: '!!!' },
        ],
      },
    ];
    expect(previewBoundText(bindings, KEY, 'Label')).toBe('Hola [inputValue]!!!');
  });

  it('renders a whole-field binding as [name]', () => {
    expect(previewBoundText([{ field: KEY, variable: 'playerName' }], KEY, 'Label')).toBe(
      '[playerName]',
    );
  });
});
