import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Door as DoorClass } from '../packs/smart_items/assets/lab_vault_door/Door';
import { fakeSdkEcs, loadScriptEngine, type ScriptEngine } from './script-harness';

const network = vi.hoisted(() => ({ synced: false }));

vi.mock('@dcl/sdk/ecs', () => fakeSdkEcs());
vi.mock('@dcl/asset-packs/dist/definitions', () => import('../src/definitions'));
vi.mock('@dcl/sdk/network', () => ({ isStateSyncronized: () => network.synced }));

describe('Door', () => {
  let ecs: ScriptEngine;
  let door: DoorClass;
  let onOpen: ReturnType<typeof vi.fn>;

  const playing = () => ecs.Animator.get(door.entity).states.find(s => s.playing);
  const sync = (next: string) => {
    const states = ecs.States.getMutable(door.entity);
    states.previousValue = states.currentValue;
    states.currentValue = next;
  };

  beforeEach(async () => {
    ecs = await loadScriptEngine();
    network.synced = false;
    const { Door } = await import('../packs/smart_items/assets/lab_vault_door/Door');
    door = new Door('src', ecs.engine.addEntity());
    door.start();
    onOpen = vi.fn();
    door.onEvent('open', onOpen);
  });

  describe('when a late joiner receives the open state', () => {
    beforeEach(() => {
      sync('Open');
      network.synced = true;
      door.update(0.016);
    });

    it('should show it open at once, without sound or events', () => {
      expect(playing()?.clip).toBe('open');
      expect(playing()?.speed).toBeGreaterThan(1);
      expect(ecs.AudioSource.getOrNull(door.entity)).toBeNull();
      expect(onOpen).not.toHaveBeenCalled();
    });
  });

  describe('when another player opens it after the state has synced', () => {
    beforeEach(() => {
      network.synced = true;
      door.update(1.5);
      sync('Open');
      door.update(0.016);
    });

    it('should play the opening with its sound and events', () => {
      expect(playing()?.clip).toBe('open');
      expect(playing()?.speed).toBe(1);
      expect(ecs.AudioSource.get(door.entity).playing).toBe(true);
      expect(onOpen).toHaveBeenCalledTimes(1);
    });
  });

  describe('when this player opens it before the state has synced', () => {
    beforeEach(() => {
      door.open();
      door.update(0.016);
    });

    it('should play the opening with its sound and events', () => {
      expect(playing()?.clip).toBe('open');
      expect(playing()?.speed).toBe(1);
      expect(ecs.AudioSource.get(door.entity).playing).toBe(true);
      expect(onOpen).toHaveBeenCalledTimes(1);
    });
  });
});
