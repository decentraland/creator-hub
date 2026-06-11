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

  it('clones a 2-level subtree as a sibling, remaps parent, and renames the root', () => {
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
    let cloneChild: Entity | null = null;
    for (const [e, t] of engine.getEntitiesWith(UiTransform)) {
      if ((t as { parent?: number }).parent === (cloneRoot as unknown as number) && e !== child) {
        cloneChild = e;
      }
    }
    expect(cloneChild).not.toBeNull();
    expect(cloneChild).not.toBe(child);
    // copy-all-LWW carried the child's UiBackground + Name verbatim.
    expect(UiBackground.getOrNull(cloneChild!)).not.toBeNull();
    expect(Name.get(cloneChild!).value).toBe('Label');

    // original is untouched.
    expect(UiTransform.get(root).parent).toBe(0);
    expect(Name.get(root).value).toBe('Panel');
    expect(UiTransform.get(child).parent).toBe(root as unknown as number);
  });
});
