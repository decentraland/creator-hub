import type { DeepReadonlyObject, Entity, IEngine } from '@dcl/ecs';

import { cleanPush } from '../utils/array';
import type { EditorComponents, Node } from './components';
import { EditorComponentNames } from './components';
import { CAMERA, PLAYER, ROOT } from './tree';

export function getParent(entity: Entity, nodes: DeepReadonlyObject<Node[]>) {
  if (isRoot(entity)) return entity;
  const node = nodes.find($ => $.children.includes(entity));
  if (node) {
    return node.entity;
  }
  return ROOT;
}

export function isRoot(entity: Entity) {
  return entity === ROOT || entity === PLAYER || entity === CAMERA;
}

export function getRoot(entity: Entity, nodes: DeepReadonlyObject<Node[]>) {
  let root = getParent(entity, nodes);
  while (!isRoot(root)) {
    root = getParent(root, nodes);
  }
  return root;
}

export function getNodes(engine: IEngine): readonly DeepReadonlyObject<Node>[] {
  const Nodes = engine.getComponent(EditorComponentNames.Nodes) as EditorComponents['Nodes'];
  return Nodes.getOrNull(engine.RootEntity)?.value || [];
}

export function removeNode(engine: IEngine, entity: Entity): Node[] {
  const nodes = getNodes(engine);
  const newValue: Node[] = [];

  for (const $ of nodes) {
    if ($.entity === entity) continue;
    newValue.push(filterChild($, entity));
  }

  return newValue;
}

export function addNode(engine: IEngine, entity: Entity): Node[] {
  const nodes = Array.from(getNodes(engine));

  const alreadyNode = nodes.find($ => $.entity === entity);
  if (!alreadyNode) nodes.push({ entity, children: [] });

  return nodes;
}

export function pushChild(engine: IEngine, parent: Entity, child: Entity): Node[] {
  return pushChildToNodes(getNodes(engine), parent, child);
}

export function pushChildToNodes(nodes: readonly Node[], parent: Entity, child: Entity): Node[] {
  const newValue: Node[] = [];
  let alreadyInNodes = false;

  for (const $ of nodes) {
    if ($.entity === parent) {
      newValue.push({ ...$, children: cleanPush($.children, child) });
    } else {
      newValue.push($);
    }
    alreadyInNodes ||= $.entity === child;
  }

  return alreadyInNodes ? newValue : [...newValue, { entity: child, children: [] }];
}

export function insertChildAfterInNodes(
  nodes: readonly Node[],
  parent: Entity,
  child: Entity,
  afterEntity: Entity,
): Node[] {
  const newValue: Node[] = [];
  let alreadyInNodes = false;

  for (const $ of nodes) {
    if ($.entity === parent) {
      const childSet = new Set($.children);
      if (childSet.has(child)) {
        newValue.push($);
      } else {
        const afterIdx = $.children.indexOf(afterEntity);
        if (afterIdx >= 0) {
          const newChildren = [...$.children];
          newChildren.splice(afterIdx + 1, 0, child);
          newValue.push({ ...$, children: newChildren });
        } else {
          newValue.push({ ...$, children: [...$.children, child] });
        }
      }
    } else {
      newValue.push($);
    }
    alreadyInNodes ||= $.entity === child;
  }

  return alreadyInNodes ? newValue : [...newValue, { entity: child, children: [] }];
}

export function removeChild(engine: IEngine, parent: Entity, child: Entity): Node[] {
  const nodes = getNodes(engine);
  const newValue: Node[] = [];

  for (const $ of nodes) {
    if ($.entity === parent) {
      newValue.push(filterChild($, child));
    } else {
      newValue.push($);
    }
  }

  return newValue;
}

export function filterChild(parent: Node, child: Entity): Node {
  return {
    ...parent,
    children: parent.children.filter($ => $ !== child),
  };
}

export function getAncestors(engine: IEngine, entity: Entity): Set<Entity> {
  const nodes = getNodes(engine);
  const map = new Map<Entity, Entity>();
  const ancestors = new Set<Entity>();

  // map of child -> parent
  for (const node of nodes) {
    node.children.forEach($ => map.set($, node.entity));
  }

  let current = entity;

  while (map.has(current)) {
    const ancestor = map.get(current)!;
    ancestors.add(ancestor);
    current = ancestor;
  }

  return ancestors;
}

// just syntax sugar
export function isAncestor(ancestors: Set<Entity>, entity: Entity): boolean {
  return ancestors.has(entity);
}

export function mapNodes(engine: IEngine, fn: (node: Node) => Node) {
  const nodes = getNodes(engine);
  const newValue: Node[] = [];

  for (const node of nodes) {
    newValue.push(fn(node));
  }

  return newValue;
}
