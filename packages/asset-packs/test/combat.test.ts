import { describe, it, expect, vi, afterEach } from 'vitest';
import { engine, Transform } from '@dcl/sdk/ecs';
import { Vector3 } from '@dcl/sdk/math';

import {
  dealDamageInRadius,
  dealHealToPlayers,
  registerDamageTarget,
  unregisterDamageTarget,
  registerHealTarget,
  onDamage,
  onHeal,
} from '../src/combat';
import { damageTargets, healTargets } from '../src/triggers';
import { ProximityLayer } from '../src/definitions';

// The combat helpers + the position/parent helpers they use are bound to the global @dcl/sdk/ecs
// engine, so these tests drive that same engine (fresh entities per test avoid cross-talk). Setup
// goes through the public API (registerDamageTarget/registerHealTarget/onDamage/onHeal); the Sets
// are only cleared here for isolation.
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
    registerHealTarget(target);
    const spy = vi.fn();
    onHeal(target, spy);

    dealHealToPlayers(engine, engine.addEntity(), { multiplier: 3 });

    expect(spy).toHaveBeenCalledTimes(3);
  });

  it('does not heal a target that is not rooted at the player', () => {
    const target = makeAt(Vector3.create(0, 0, 0)); // no player parent
    registerHealTarget(target);
    const spy = vi.fn();
    onHeal(target, spy);

    dealHealToPlayers(engine, engine.addEntity(), { multiplier: 5 });

    expect(spy).not.toHaveBeenCalled();
  });
});

describe('dealDamageInRadius', () => {
  it('damages a registered target in range `hits` times and skips one out of range', () => {
    const origin = makeAt(Vector3.create(0, 0, 0));
    const inRange = makeAt(Vector3.create(0, 0, 3));
    const outOfRange = makeAt(Vector3.create(0, 0, 100));
    registerDamageTarget(inRange);
    registerDamageTarget(outOfRange);
    const hitSpy = vi.fn();
    const missSpy = vi.fn();
    onDamage(inRange, hitSpy);
    onDamage(outOfRange, missSpy);

    dealDamageInRadius(engine, origin, { radius: 5, hits: 2 });

    expect(hitSpy).toHaveBeenCalledTimes(2);
    expect(missSpy).not.toHaveBeenCalled();
  });

  it('honors the PLAYER layer filter (hits player-rooted targets, skips others)', () => {
    const origin = makeAt(Vector3.create(0, 0, 0));
    const playerTarget = makeAt(Vector3.create(0, 0, 1), engine.PlayerEntity);
    const otherTarget = makeAt(Vector3.create(0, 0, 1));
    registerDamageTarget(playerTarget);
    registerDamageTarget(otherTarget);
    const playerSpy = vi.fn();
    const otherSpy = vi.fn();
    onDamage(playerTarget, playerSpy);
    onDamage(otherTarget, otherSpy);

    dealDamageInRadius(engine, origin, { radius: 5, layer: ProximityLayer.PLAYER });

    expect(playerSpy).toHaveBeenCalledTimes(1);
    expect(otherSpy).not.toHaveBeenCalled();
  });

  it('honors the NON_PLAYER layer filter (skips player-rooted targets)', () => {
    const origin = makeAt(Vector3.create(0, 0, 0));
    const playerTarget = makeAt(Vector3.create(0, 0, 1), engine.PlayerEntity);
    registerDamageTarget(playerTarget);
    const spy = vi.fn();
    onDamage(playerTarget, spy);

    dealDamageInRadius(engine, origin, { radius: 5, layer: ProximityLayer.NON_PLAYER });

    expect(spy).not.toHaveBeenCalled();
  });

  it('stops damaging a target once it is unregistered', () => {
    const origin = makeAt(Vector3.create(0, 0, 0));
    const target = makeAt(Vector3.create(0, 0, 1));
    registerDamageTarget(target);
    unregisterDamageTarget(target);
    const spy = vi.fn();
    onDamage(target, spy);

    dealDamageInRadius(engine, origin, { radius: 5 });

    expect(spy).not.toHaveBeenCalled();
  });
});
