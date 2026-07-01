import type { Entity, IEngine, NameComponent } from '@dcl/ecs';
import { Transform as TransformEngine, Name as NameEngine } from '@dcl/ecs';

import type { EditorComponents } from '../components';
import { EditorComponentNames } from '../components';
import { getNodes, pushChild } from '../nodes';

export function addChild(engine: IEngine) {
  return function addChild(parent: Entity, name: string): Entity {
    const child = engine.addEntity();
    const Transform = engine.getComponent(TransformEngine.componentName) as typeof TransformEngine;
    const Nodes = engine.getComponent(EditorComponentNames.Nodes) as EditorComponents['Nodes'];
    const Name = engine.getComponent(NameEngine.componentName) as typeof NameEngine;

    // create new child components
    Name.create(child, { value: generateUniqueName(engine, Name, name) });
    Transform.create(child, { parent });
    // update Nodes component
    Nodes.createOrReplace(engine.RootEntity, { value: pushChild(engine, parent, child) });

    return child;
  };
}

export function generateUniqueName(engine: IEngine, Name: NameComponent, value: string): string {
  const baseName = getSuffixDigits(value) !== -1 ? value.slice(0, value.lastIndexOf('_')) : value;
  const pattern = new RegExp(`^${baseName.toLowerCase()}(_\\d+)?$`, 'i');
  const nodes = getNodes(engine);

  let isFirst = true;
  let max = 1;
  for (const $ of nodes) {
    const name = (Name.getOrNull($.entity)?.value || '').toLowerCase();
    if (pattern.test(name)) {
      isFirst = false;
      const suffix = getSuffixDigits(name);
      if (suffix !== -1) {
        max = Math.max(max, suffix);
      }
    }
  }

  const suffix = isFirst ? '' : `_${max + 1}`;

  return `${baseName}${suffix}`;
}

// UI Designer nodes carry only core::UiTransform and never enter the editor `Nodes`
// tree, so generateUniqueName (which walks getNodes) can't see them. Scan every named
// entity instead: names must be GLOBALLY unique for engine.getEntityByName to resolve a
// UI node unambiguously. Uses the smallest free suffix starting at _1 (Label, Label_1,
// Label_2, …) — matching the codegen enum-key dedup (engine-to-composite.buildEnumEntries),
// so entity Name values line up with the generated UiEntityNames keys.
export function generateUniqueUiName(engine: IEngine, Name: NameComponent, value: string): string {
  const baseName = getSuffixDigits(value) !== -1 ? value.slice(0, value.lastIndexOf('_')) : value;
  const taken = new Set<string>();
  for (const [, name] of engine.getEntitiesWith(Name)) {
    const current = (name?.value || '').toLowerCase();
    if (current) taken.add(current);
  }

  if (!taken.has(baseName.toLowerCase())) return baseName;
  let suffix = 1;
  while (taken.has(`${baseName.toLowerCase()}_${suffix}`)) suffix++;
  return `${baseName}_${suffix}`;
}

export function getSuffixDigits(name: string): number {
  const underscoreIndex = name.lastIndexOf('_');
  if (underscoreIndex === -1 || underscoreIndex === name.length - 1) return -1;

  const digits = name.slice(underscoreIndex + 1);
  return /^\d+$/.test(digits) ? parseInt(digits, 10) : -1;
}

export default addChild;
