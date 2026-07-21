import type { Entity } from '@dcl/ecs';

/**
 * Returns the set of entities that should remain visible in the tree for a given
 * search term: every entity whose label contains the term (case insensitive),
 * plus all of its ancestors so matches keep their hierarchy context.
 */
export function filterEntityTree(
  roots: Entity[],
  getChildren: (entity: Entity) => Entity[],
  getLabel: (entity: Entity) => string,
  search: string,
): Set<Entity> {
  const term = search.toLowerCase();
  const visible = new Set<Entity>();

  const traverse = (entity: Entity): boolean => {
    let hasMatch = false;
    for (const child of getChildren(entity)) {
      hasMatch = traverse(child) || hasMatch;
    }
    if (getLabel(entity).toLowerCase().includes(term)) {
      hasMatch = true;
    }
    if (hasMatch) visible.add(entity);
    return hasMatch;
  };

  for (const root of roots) {
    traverse(root);
  }

  return visible;
}
