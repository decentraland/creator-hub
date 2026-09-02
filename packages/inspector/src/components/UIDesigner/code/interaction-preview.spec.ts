import { describe, expect, it } from 'vitest';

import { generateInteractionHelper } from './aggregator';
import { previewLayers, resolveInteractionPreview } from './interaction-preview';
import type { CodeUINode } from './types';

// Guards the preview against drifting from the generated runtime helper, which
// lives in a runtime we can't import from.
describe('when checking the preview against the generated runtime helper', () => {
  it('should apply the layers in the same precedence order', () => {
    const helper = generateInteractionHelper();
    const order = (['active', 'hover', 'press'] as const).map(k => helper.indexOf(`layers.${k}`));
    expect(order.every(i => i > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(previewLayers({ layer: 'active', hovered: true, pressed: true })).toEqual([
      'active',
      'hover',
      'press',
    ]);
  });

  it('should still deep-merge, which the PB-side merge mirrors', () => {
    expect(generateInteractionHelper()).toContain('merge(prev, next)');
  });
});

// A node as the parse adapter produces it: its own bags ARE the base layer, and
// `interaction.states` holds every layer (base included).
function node(): CodeUINode {
  return {
    entity: 1 as never,
    type: 'UiEntity',
    name: 'UiEntity',
    span: [0, 0],
    children: [],
    uiTransform: { width: 100, parent: 7 },
    uiBackground: { color: { r: 1, g: 1, b: 1, a: 1 }, textureMode: 2 },
    interaction: {
      states: {
        base: {
          uiTransform: { width: 100 },
          uiBackground: { color: { r: 1, g: 1, b: 1, a: 1 }, textureMode: 2 },
        },
        hover: { uiBackground: { color: { r: 0, g: 0, b: 1, a: 1 } } },
        press: { uiTransform: { width: 90 } },
        active: { uiBackground: { color: { r: 1, g: 0, b: 0, a: 1 } } },
      },
    },
  } as CodeUINode;
}

describe('when choosing which layers a preview applies', () => {
  it('should apply nothing for the base layer with no pointer state', () => {
    expect(previewLayers({ layer: 'base' })).toEqual([]);
  });

  it('should apply the layer the panel is editing', () => {
    expect(previewLayers({ layer: 'hover' })).toEqual(['hover']);
    expect(previewLayers({ layer: 'active' })).toEqual(['active']);
  });

  it('should apply live pointer state', () => {
    expect(previewLayers({ hovered: true })).toEqual(['hover']);
    expect(previewLayers({ hovered: true, pressed: true })).toEqual(['hover', 'press']);
  });

  it('should emit runtime precedence order regardless of input order', () => {
    expect(previewLayers({ layer: 'active', hovered: true, pressed: true })).toEqual([
      'active',
      'hover',
      'press',
    ]);
  });

  it('should collapse a duplicate between the edited layer and pointer state', () => {
    expect(previewLayers({ layer: 'hover', hovered: true })).toEqual(['hover']);
  });
});

describe('when resolving an interaction preview', () => {
  it('should return the node unchanged when nothing applies', () => {
    const n = node();
    expect(resolveInteractionPreview(n, [])).toBe(n);
  });

  it('should return the node unchanged when it has no interaction states', () => {
    const plain = { ...node(), interaction: undefined } as CodeUINode;
    expect(resolveInteractionPreview(plain, ['hover'])).toBe(plain);
  });

  it('should ignore layers the node does not author', () => {
    const bare = node();
    bare.interaction!.states = { base: {}, hover: {} };
    expect(resolveInteractionPreview(bare, ['press'])).toBe(bare);
  });

  it('should merge an override over the base bag without dropping siblings', () => {
    const out = resolveInteractionPreview(node(), ['hover']);
    expect(out.uiBackground).toEqual({ color: { r: 0, g: 0, b: 1, a: 1 }, textureMode: 2 });
  });

  it('should preserve structural fields the layers never carry', () => {
    // uiTransform.parent drives canvas layout and exists only on the node.
    const out = resolveInteractionPreview(node(), ['press']);
    expect(out.uiTransform).toEqual({ width: 90, parent: 7 });
  });

  it('should apply later layers over earlier ones', () => {
    const out = resolveInteractionPreview(node(), ['active', 'hover']);
    // hover comes after active, so blue wins over red.
    expect((out.uiBackground as any).color).toEqual({ r: 0, g: 0, b: 1, a: 1 });
  });

  it('should not mutate the input node', () => {
    const n = node();
    resolveInteractionPreview(n, ['hover', 'press']);
    expect(n.uiBackground).toEqual({ color: { r: 1, g: 1, b: 1, a: 1 }, textureMode: 2 });
    expect(n.uiTransform).toEqual({ width: 100, parent: 7 });
  });
});
