import type { Entity } from '@dcl/ecs';

import { filterEntityTree } from './utils';

describe('filterEntityTree', () => {
  const ROOT = 0 as Entity;
  const PINE_TREE = 512 as Entity;
  const HOUSE = 513 as Entity;
  const DOOR = 514 as Entity;
  const ROCK = 515 as Entity;

  let labels: Map<Entity, string>;
  let children: Map<Entity, Entity[]>;
  let getLabel: (entity: Entity) => string;
  let getChildren: (entity: Entity) => Entity[];

  beforeEach(() => {
    labels = new Map<Entity, string>([
      [ROOT, 'Scene'],
      [PINE_TREE, 'Pine Tree'],
      [HOUSE, 'House'],
      [DOOR, 'Door'],
      [ROCK, 'Rock'],
    ]);
    children = new Map<Entity, Entity[]>([
      [ROOT, [PINE_TREE, HOUSE]],
      [HOUSE, [DOOR, ROCK]],
    ]);
    getLabel = entity => labels.get(entity) ?? '';
    getChildren = entity => children.get(entity) ?? [];
  });

  describe('when the search term matches the middle of a label', () => {
    it('should include the matching entity and its ancestors', () => {
      const visible = filterEntityTree([ROOT], getChildren, getLabel, 'tree');
      expect(visible).toEqual(new Set([ROOT, PINE_TREE]));
    });
  });

  describe('when the search term uses a different casing than the label', () => {
    it('should match case insensitively', () => {
      const visible = filterEntityTree([ROOT], getChildren, getLabel, 'TREE');
      expect(visible).toEqual(new Set([ROOT, PINE_TREE]));
    });
  });

  describe('when the search term matches a nested entity', () => {
    it('should include every ancestor up to the root', () => {
      const visible = filterEntityTree([ROOT], getChildren, getLabel, 'door');
      expect(visible).toEqual(new Set([ROOT, HOUSE, DOOR]));
    });
  });

  describe('when the search term matches a parent but not its children', () => {
    it('should not include the non-matching children', () => {
      const visible = filterEntityTree([ROOT], getChildren, getLabel, 'house');
      expect(visible).toEqual(new Set([ROOT, HOUSE]));
    });
  });

  describe('when the search term matches nothing', () => {
    it('should return an empty set', () => {
      const visible = filterEntityTree([ROOT], getChildren, getLabel, 'spaceship');
      expect(visible.size).toBe(0);
    });
  });

  describe('when there are multiple roots', () => {
    const CAMERA = 2 as Entity;

    beforeEach(() => {
      labels.set(CAMERA, 'Camera');
    });

    it('should include matches from every root', () => {
      const visible = filterEntityTree([ROOT, CAMERA], getChildren, getLabel, 'ca');
      expect(visible).toEqual(new Set([CAMERA]));
    });
  });
});
