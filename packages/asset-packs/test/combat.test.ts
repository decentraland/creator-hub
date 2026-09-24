import { describe, it, expect, vi, afterEach } from 'vitest';
import { engine, Transform } from '@dcl/sdk/ecs';
import { Vector3 } from '@dcl/sdk/math';

import { dealDamageInRadius, dealHealToPlayers } from '../src/combat';
import { damageTargets, healTargets } from '../src/triggers';
import { getTriggerEvents } from '../src/events';
import { ProximityLayer, TriggerType } from '../src/definitions';

// The combat helpers + the position/parent helpers they use are bound to the global @dcl/sdk/ecs
// engine, so these tests drive that same engine (fresh entities per test avoid cross-talk).

afterEach(() => {
  damageTargets.clear();
  healTargets.clear();
});

function makeAt(position: Vector3, parent?: number) {
  const entity = engine.addEntity();
  Transform.create(entity, {
    position,
    ...(parent !== undefined ? { parent: parent as never } : {}),
  });
  return entity;
}

describe('dealHealToPlayers', () => {
  it('heals a player-rooted target `multiplier` times', () => {
    const target = makeAt(Vector3.create(0, 0, 0), engine.PlayerEntity);
    healTargets.add(target);
    const spy = vi.fn();
    getTriggerEvents(target).on(TriggerType.ON_HEAL_PLAYER, spy);

    dealHealToPlayers(engine, engine.addEntity(), { multiplier: 3 });

    expect(spy).toHaveBeenCalledTimes(3);
  });

  it('does not heal a target that is not rooted at the player', () => {
    const target = makeAt(Vector3.create(0, 0, 0)); // no player parent
    healTargets.add(target);
    const spy = vi.fn();
    getTriggerEvents(target).on(TriggerType.ON_HEAL_PLAYER, spy);

    dealHealToPlayers(engine, engine.addEntity(), { multiplier: 5 });

    expect(spy).not.toHaveBeenCalled();
  });
});

describe('dealDamageInRadius', () => {
  it('damages a target in range `hits` times and skips one out of range', () => {
    const origin = makeAt(Vector3.create(0, 0, 0));
    const inRange = makeAt(Vector3.create(0, 0, 3));
    const outOfRange = makeAt(Vector3.create(0, 0, 100));
    damageTargets.add(inRange);
    damageTargets.add(outOfRange);
    const hitSpy = vi.fn();
    const missSpy = vi.fn();
    getTriggerEvents(inRange).on(TriggerType.ON_DAMAGE, hitSpy);
    getTriggerEvents(outOfRange).on(TriggerType.ON_DAMAGE, missSpy);

    dealDamageInRadius(engine, origin, { radius: 5, hits: 2 });

    expect(hitSpy).toHaveBeenCalledTimes(2);
    expect(missSpy).not.toHaveBeenCalled();
  });

  it('honors the NON_PLAYER layer filter (skips player-rooted targets)', () => {
    const origin = makeAt(Vector3.create(0, 0, 0));
    const playerTarget = makeAt(Vector3.create(0, 0, 1), engine.PlayerEntity);
    damageTargets.add(playerTarget);
    const spy = vi.fn();
    getTriggerEvents(playerTarget).on(TriggerType.ON_DAMAGE, spy);

    dealDamageInRadius(engine, origin, { radius: 5, layer: ProximityLayer.NON_PLAYER });

    expect(spy).not.toHaveBeenCalled();
  });
});
