import type { Entity, IEngine, LastWriteWinElementSetComponentDefinition } from '@dcl/ecs';
import type { UIBinding, UIBindings } from '@dcl/asset-packs';
import { ComponentName } from '@dcl/asset-packs';

// Single audited home for the UIBindings readonly->mutable boundary.
// The component's deserialized rows are DeepReadonly; writing them back through
// createOrReplace needs one cast. Confining that cast here (instead of five
// copy-pasted call sites) keeps the unsafe boundary auditable. See
// docs/specs/ui-designer-mixed-content/review.md Section 2.

// Resolve the component without creating it. Returns null when the component
// has never been defined on the engine — callers that must not create the
// component (unbind / rename / delete) branch on this.
export function getBindingsComponentOrNull(
  engine: IEngine,
): LastWriteWinElementSetComponentDefinition<UIBindings> | null {
  return engine.getComponentOrNull(
    ComponentName.UI_BINDINGS,
  ) as LastWriteWinElementSetComponentDefinition<UIBindings> | null;
}

// Read the entity's binding rows. Returns an empty array when the component or
// the entity's row is absent; never creates the component. getOrNull yields a
// DeepReadonly snapshot; the read-side mutable->readonly boundary cast lives
// here so callers receive a plain UIBinding[] they can map/filter/spread over.
export function getBindingsRows(engine: IEngine, entity: Entity): UIBinding[] {
  const Bindings = getBindingsComponentOrNull(engine);
  if (!Bindings) return [];
  const current = Bindings.getOrNull(entity);
  return current ? ([...current.value] as UIBinding[]) : [];
}

// Write the entity's binding rows. Owns the single readonly->mutable cast and
// resolves the component via getComponent (creating it if needed) — only
// callers that intend to create-or-replace should reach this.
export function writeBindingsRows(engine: IEngine, entity: Entity, rows: UIBinding[]): void {
  const Bindings = engine.getComponent(
    ComponentName.UI_BINDINGS,
  ) as LastWriteWinElementSetComponentDefinition<UIBindings>;
  Bindings.createOrReplace(entity, { value: rows as UIBindings['value'] });
}
