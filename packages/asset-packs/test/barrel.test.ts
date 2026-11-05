import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Entity } from '@dcl/ecs';
import type { Barrel as BarrelClass } from '../packs/smart_items/assets/barrel/Barrel';
import { fakeSdkEcs, loadScriptEngine, type ScriptEngine } from './script-harness';

vi.mock('@dcl/sdk/ecs', () => fakeSdkEcs());
vi.mock('@dcl/asset-packs/dist/events', () => import('../src/events'));
vi.mock('@dcl/asset-packs/dist/components', () => import('../src/components'));
vi.mock('@dcl/asset-packs/dist/helpers', () => import('../src/helpers'));
vi.mock('@dcl/asset-packs/dist/definitions', () => import('../src/definitions'));
vi.mock('@dcl/asset-packs/dist/triggers', () => import('../src/triggers'));

describe('Barrel', () => {
  let ecs: ScriptEngine;
  let barrel: BarrelClass;
  let damageTargets: Set<Entity>;
  let hits: Map<Entity, number>;

  const addTarget = async (position: { x: number; y: number; z: number }, parent?: Entity) => {
    const { getTriggerEvents } = await import('../src/events');
    const { TriggerType } = await import('../src/definitions');
    const target = ecs.engine.addEntity();
    ecs.Transform.create(target, { position, parent });
    damageTargets.add(target);
    hits.set(target, 0);
    getTriggerEvents(target).on(TriggerType.ON_DAMAGE, () => {
      hits.set(target, (hits.get(target) ?? 0) + 1);
    });
    return target;
  };

  beforeEach(async () => {
    ecs = await loadScriptEngine();
    ({ damageTargets } = await import('../src/triggers'));
    hits = new Map();
    const { Barrel } = await import('../packs/smart_items/assets/barrel/Barrel');
    const entity = ecs.engine.addEntity();
    ecs.Transform.create(entity, { position: { x: 0, y: 0, z: 0 } });
    barrel = new Barrel('src', entity);
    barrel.start();
  });

  afterEach(() => {
    damageTargets.clear();
  });

  describe('when it explodes next to a target of its own and a separate one', () => {
    let child: Entity;
    let neighbour: Entity;

    beforeEach(async () => {
      child = await addTarget({ x: 0, y: 1, z: 0 }, barrel.entity);
      neighbour = await addTarget({ x: 1, y: 0, z: 0 });
      barrel.explode();
    });

    it('should damage the separate target', () => {
      expect(hits.get(neighbour)).toBe(barrel.explosionDamage);
    });

    it('should not damage anything parented to the barrel', () => {
      expect(hits.get(child)).toBe(0);
    });
  });

  describe('when it has exploded', () => {
    beforeEach(() => {
      barrel.explode();
    });

    it('should still be there just under a second later', () => {
      barrel.update(0.9);
      expect(ecs.engine.getEntityState(barrel.entity)).toBe(ecs.EntityState.UsedEntity);
    });

    it('should be removed one second later', () => {
      barrel.update(1);
      expect(ecs.engine.getEntityState(barrel.entity)).not.toBe(ecs.EntityState.UsedEntity);
    });
  });
});
