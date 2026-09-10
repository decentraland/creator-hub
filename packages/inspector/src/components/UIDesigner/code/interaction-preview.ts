import type { InteractionStateKey } from './interaction-convention';
import type { CodeUINode, InteractionStateStyles } from './types';

const STYLE_FIELDS = ['uiTransform', 'uiBackground', 'uiText', 'uiInput', 'uiDropdown'] as const;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

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

/** The layers to apply, in precedence order, for a preview; `base` is implicit and duplicates collapse. */
export function previewLayers(opts: {
  layer?: InteractionStateKey;
  hovered?: boolean;
  pressed?: boolean;
}): InteractionStateKey[] {
  const wanted = new Set<InteractionStateKey>();
  if (opts.layer && opts.layer !== 'base') wanted.add(opts.layer);
  if (opts.hovered) wanted.add('hover');
  if (opts.pressed) wanted.add('press');
  return (['active', 'hover', 'press'] as const).filter(k => wanted.has(k));
}

/** A copy of `node` whose style bags are resolved for `layers`; returns the node unchanged when there's nothing to apply. */
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
