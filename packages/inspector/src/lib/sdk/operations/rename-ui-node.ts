import type { Entity, IEngine, NameComponent } from '@dcl/ecs';

const NAME_ID = 'core-schema::Name';

// Rename a UI node's core-schema::Name, keeping the value GLOBALLY unique
// (excluding the node itself) so engine.getEntityByName and the generated
// UiEntityNames enum stay unambiguous — see CLAUDE.md. A collision gets the
// smallest free `_N` suffix (Label, Label_1, …), mirroring generateUniqueUiName
// but excluding `entity`'s own current name from the taken set. Empty/whitespace
// names are ignored (no-op). Returns the name actually written, or null on no-op.
export function renameUINode(engine: IEngine) {
  return function renameUINode(entity: Entity, requested: string): string | null {
    const Name = engine.getComponentOrNull(NAME_ID) as NameComponent | null;
    if (!Name || !Name.has(entity)) return null;
    const base = requested.trim();
    if (!base) return null;

    // Split any existing numeric suffix off the requested base so re-suffixing
    // is idempotent (renaming "Label_2" to "Label_2" stays "Label_2").
    const underscore = base.lastIndexOf('_');
    const stem =
      underscore > 0 && /^\d+$/.test(base.slice(underscore + 1)) ? base.slice(0, underscore) : base;

    const taken = new Set<string>();
    for (const [other, value] of engine.getEntitiesWith(Name)) {
      if (other === entity) continue; // exclude self
      const v = (value?.value || '').toLowerCase();
      if (v) taken.add(v);
    }

    let name = base;
    if (taken.has(base.toLowerCase())) {
      let n = 1;
      while (taken.has(`${stem.toLowerCase()}_${n}`)) n++;
      name = `${stem}_${n}`;
    }
    Name.createOrReplace(entity, { value: name });
    return name;
  };
}

export default renameUINode;
