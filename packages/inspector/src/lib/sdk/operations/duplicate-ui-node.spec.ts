import { describe, expect, it, beforeEach } from 'vitest';
import type { Entity, IEngine } from '@dcl/ecs';
import { Engine } from '@dcl/ecs';
import * as components from '@dcl/ecs/dist/components';

import { duplicateUINode } from './duplicate-ui-node';

describe('duplicateUINode', () => {
  let engine: IEngine;
  let UiTransform: ReturnType<typeof components.UiTransform>;
  let UiBackground: ReturnType<typeof components.UiBackground>;
  let Name: ReturnType<typeof components.Name>;

  beforeEach(() => {
    engine = Engine();
    UiTransform = components.UiTransform(engine);
    UiBackground = components.UiBackground(engine);
    Name = components.Name(engine);
  });

  const findChildOf = (parent: Entity, exclude: Entity[]): Entity | null => {
    for (const [e, t] of engine.getEntitiesWith(UiTransform)) {
      if (
        (t as { parent?: number }).parent === (parent as unknown as number) &&
        !exclude.includes(e)
      ) {
        return e;
      }
    }
    return null;
  };

  it('clones a 2-level subtree as a sibling, remaps parent, and uniquely renames every clone', () => {
    const root = engine.addEntity();
    UiTransform.create(root, { parent: 0 } as never);
    Name.create(root, { value: 'Panel' });

    const child = engine.addEntity();
    UiTransform.create(child, { parent: root } as never);
    Name.create(child, { value: 'Label' });
    UiBackground.create(child, { color: { r: 1, g: 0, b: 0, a: 1 } } as never);

    const cloneRoot = duplicateUINode(engine)(root);

    // distinct entity, attached as a sibling of root (same external parent).
    expect(cloneRoot).not.toBe(root);
    expect(cloneRoot).not.toBe(child);
    expect(UiTransform.get(cloneRoot).parent).toBe(UiTransform.get(root).parent);
    expect(Name.get(cloneRoot).value).toBe('Panel copy');

    // the cloned child is parented to the clone-root (remapped), not the original.
    const cloneChild = findChildOf(cloneRoot, [child]);
    expect(cloneChild).not.toBeNull();
    expect(cloneChild).not.toBe(child);
    // copy-all-LWW carried the child's UiBackground verbatim.
    expect(UiBackground.getOrNull(cloneChild!)).not.toBeNull();
    // ...but the Name is re-uniqued: 'Label' is taken, so the clone gets 'Label_1'.
    // (Duplicate Name *values* would make engine.getEntityByName / UiEntityNames ambiguous.)
    expect(Name.get(cloneChild!).value).not.toBe('Label');
    expect(Name.get(cloneChild!).value).toBe('Label_1');

    // original is untouched.
    expect(UiTransform.get(root).parent).toBe(0);
    expect(Name.get(root).value).toBe('Panel');
    expect(UiTransform.get(child).parent).toBe(root as unknown as number);
  });

  it('gives each repeated duplicate of the same node a globally-unique name', () => {
    const root = engine.addEntity();
    UiTransform.create(root, { parent: 0 } as never);
    Name.create(root, { value: 'Panel' });

    const child = engine.addEntity();
    UiTransform.create(child, { parent: root } as never);
    Name.create(child, { value: 'Label' });

    const firstCopy = duplicateUINode(engine)(root);
    const secondCopy = duplicateUINode(engine)(root);

    // Second duplicate must not collide with the first.
    expect(Name.get(firstCopy).value).toBe('Panel copy');
    expect(Name.get(secondCopy).value).not.toBe('Panel copy');
    expect(Name.get(secondCopy).value).toBe('Panel copy_1');

    // Every named entity has a distinct Name value.
    const names = [...engine.getEntitiesWith(Name)].map(([, n]) => (n as { value: string }).value);
    expect(new Set(names).size).toBe(names.length);
  });
});
