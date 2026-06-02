import type { Entity, IEngine } from '@dcl/ecs';

export type UINodeType = 'UiEntity' | 'Label' | 'Button' | 'Input' | 'Dropdown';

export interface UINode {
  entity: Entity;
  type: UINodeType;
  name: string;
  uiTransform?: unknown;
  uiBackground?: unknown;
  uiText?: unknown;
  uiInput?: unknown;
  uiDropdown?: unknown;
  children: UINode[];
}

interface ComponentBag {
  UiTransform: any;
  UiBackground: any;
  UiText: any;
  UiInput: any;
  UiDropdown: any;
  Name?: any;
}

// Canonical SDK component IDs (verified against
// node_modules/@dcl/ecs/dist/components/generated/component-names.gen.js).
const COMPONENT_IDS = {
  UiTransform: 'core::UiTransform',
  UiBackground: 'core::UiBackground',
  UiText: 'core::UiText',
  UiInput: 'core::UiInput',
  UiDropdown: 'core::UiDropdown',
  Name: 'core-schema::Name',
} as const;

export function getComponentBag(engine: IEngine): ComponentBag {
  return {
    UiTransform: engine.getComponentOrNull(COMPONENT_IDS.UiTransform),
    UiBackground: engine.getComponentOrNull(COMPONENT_IDS.UiBackground),
    UiText: engine.getComponentOrNull(COMPONENT_IDS.UiText),
    UiInput: engine.getComponentOrNull(COMPONENT_IDS.UiInput),
    UiDropdown: engine.getComponentOrNull(COMPONENT_IDS.UiDropdown),
    Name: engine.getComponentOrNull(COMPONENT_IDS.Name),
  };
}

export function classifyNode(bag: ComponentBag, entity: Entity): UINodeType {
  if (bag.UiInput?.has(entity)) return 'Input';
  if (bag.UiDropdown?.has(entity)) return 'Dropdown';
  if (bag.UiText?.has(entity)) return 'Label';
  // Buttons are heuristic: a UiEntity with a pointer-events listener.
  // In the absence of a pointer-events component, fall back to UiEntity.
  return 'UiEntity';
}

export function buildUINodeTree(engine: IEngine, rootEntity: Entity): UINode | null {
  const bag = getComponentBag(engine);
  if (!bag.UiTransform || !bag.UiTransform.has(rootEntity)) return null;

  // Collect every entity whose UiTransform.parent points at someone we've visited,
  // starting from rootEntity. Single pass over the UiTransform iterator suffices.
  const childrenOf = new Map<Entity, Entity[]>();
  for (const [entity, value] of bag.UiTransform.iterator() as Iterable<[Entity, any]>) {
    const parent: Entity | undefined = value?.parent;
    if (parent === undefined) continue;
    const list = childrenOf.get(parent) ?? [];
    list.push(entity);
    childrenOf.set(parent, list);
  }

  const visited = new Set<Entity>();
  function visit(entity: Entity): UINode {
    if (visited.has(entity)) {
      // Defensive — should not happen for a well-formed scene.
      return {
        entity,
        type: 'UiEntity',
        name: `Entity ${entity}`,
        children: [],
      };
    }
    visited.add(entity);
    const type = classifyNode(bag, entity);
    const name = bag.Name?.getOrNull(entity)?.value ?? `Entity ${entity}`;
    const node: UINode = {
      entity,
      type,
      name,
      uiTransform: bag.UiTransform.getOrNull(entity) ?? undefined,
      uiBackground: bag.UiBackground?.getOrNull(entity) ?? undefined,
      uiText: bag.UiText?.getOrNull(entity) ?? undefined,
      uiInput: bag.UiInput?.getOrNull(entity) ?? undefined,
      uiDropdown: bag.UiDropdown?.getOrNull(entity) ?? undefined,
      children: (childrenOf.get(entity) ?? []).map(visit),
    };
    return node;
  }

  return visit(rootEntity);
}
