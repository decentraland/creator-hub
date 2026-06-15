import { describe, expect, it, beforeEach } from 'vitest';
import type { IEngine } from '@dcl/ecs';
import { Engine } from '@dcl/ecs';
import * as components from '@dcl/ecs/dist/components';

import { removeUINode } from './remove-ui-node';

describe('removeUINode', () => {
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

  it('removes the root and every descendant, returning the inclusive subtree', () => {
    const root = engine.addEntity();
    UiTransform.create(root, { parent: 0 } as never);
    Name.create(root, { value: 'Panel' });

    const child = engine.addEntity();
    UiTransform.create(child, { parent: root } as never);
    Name.create(child, { value: 'Label' });
    UiBackground.create(child, { color: { r: 1, g: 0, b: 0, a: 1 } } as never);

    const removed = removeUINode(engine)(root);

    // Returned set is the inclusive subtree.
    expect(removed).toEqual(new Set([root, child]));

    // Every LWW component is gone from both entities.
    expect(UiTransform.getOrNull(root)).toBeNull();
    expect(Name.getOrNull(root)).toBeNull();
    expect(UiTransform.getOrNull(child)).toBeNull();
    expect(Name.getOrNull(child)).toBeNull();
    expect(UiBackground.getOrNull(child)).toBeNull();
  });

  it('leaves entities outside the subtree untouched', () => {
    const root = engine.addEntity();
    UiTransform.create(root, { parent: 0 } as never);

    const sibling = engine.addEntity();
    UiTransform.create(sibling, { parent: 0 } as never);
    Name.create(sibling, { value: 'Other' });

    const removed = removeUINode(engine)(root);

    expect(removed).toEqual(new Set([root]));
    expect(UiTransform.getOrNull(root)).toBeNull();
    // The unrelated sibling survives.
    expect(UiTransform.getOrNull(sibling)).not.toBeNull();
    expect(Name.get(sibling).value).toBe('Other');
  });
});
