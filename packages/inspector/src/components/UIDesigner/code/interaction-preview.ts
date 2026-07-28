// Canvas-side resolution of interaction-state styles. The generated runtime
// helper (aggregator.generateInteractionHelper) deep-merges its layers in the
// order base → active → hover → press; this reproduces that EXACT precedence so
// the canvas preview matches what the scene renders. Keeping the rule in one
// pure function beside the convention is what stops the two from drifting.
//
// Operates on the PB-shaped bags the node already carries (the parse adapter
// normalized every layer), so the canvas renderer needs no new value handling —
// it just receives a node whose bags are the resolved ones.

import type { InteractionStateKey } from './interaction-convention';
import type { CodeUINode, InteractionStateStyles } from './types';

const STYLE_FIELDS = ['uiTransform', 'uiBackground', 'uiText', 'uiInput', 'uiDropdown'] as const;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Deep-merge `over` onto `base`, mirroring the runtime helper's merge so a layer
// can override one nested field (just uiBackground.color) without dropping its
// siblings.
function merge(
  base: Record<string, unknown>,
  over: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!over) return base;
  const out: Record<string, unknown> = { ...base };
  for (const key of Object.keys(over)) {
    const next = over[key];
    const prev = out[key];
    out[key] = isPlainObject(next) && isPlainObject(prev) ? merge(prev, next) : next;
  }
  return out;
}

// The layers to apply, in precedence order, for a preview. `layer` is the state
// the panel is editing (so editing Hover previews Hover even without the pointer
// there); `hovered`/`pressed` are live canvas pointer state. Duplicates collapse
// and `base` is implicit.
export function previewLayers(opts: {
  layer?: InteractionStateKey;
  hovered?: boolean;
  pressed?: boolean;
}): InteractionStateKey[] {
  const wanted = new Set<InteractionStateKey>();
  if (opts.layer && opts.layer !== 'base') wanted.add(opts.layer);
  if (opts.hovered) wanted.add('hover');
  if (opts.pressed) wanted.add('press');
  // Emit in runtime precedence order, not insertion order.
  return (['active', 'hover', 'press'] as const).filter(k => wanted.has(k));
}

// A copy of `node` whose style bags are resolved for `layers`. Returns the node
// unchanged when it has no interaction states or nothing to apply, so callers can
// use it unconditionally without allocating on the common path.
export function resolveInteractionPreview(
  node: CodeUINode,
  layers: InteractionStateKey[],
): CodeUINode {
  const states = node.interaction?.states;
  if (!states || layers.length === 0) return node;

  const applicable = layers.filter(k => states[k]);
  if (applicable.length === 0) return node;

  type StyleField = (typeof STYLE_FIELDS)[number];
  const patch: Partial<Record<StyleField, Record<string, unknown>>> = {};
  for (const field of STYLE_FIELDS) {
    // The node's own bag IS the base layer (the parse adapter hydrated it), and
    // it also carries structural data the layers never hold — uiTransform.parent,
    // which the canvas needs for layout — so start from the node, not states.base.
    let bag = node[field] as Record<string, unknown> | undefined;
    let touched = false;
    for (const key of applicable) {
      const over = (states[key] as InteractionStateStyles | undefined)?.[field];
      if (!over) continue;
      bag = merge(bag ?? {}, over as Record<string, unknown>);
      touched = true;
    }
    if (touched && bag) patch[field] = bag;
  }
  return { ...node, ...patch };
}
