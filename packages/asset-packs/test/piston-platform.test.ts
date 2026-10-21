import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PistonPlatform as PistonPlatformClass } from '../packs/smart_items/assets/lab_stair_platform/PistonPlatform';
import { fakeSdkEcs, loadScriptEngine, type ScriptEngine } from './script-harness';

const network = vi.hoisted(() => ({ synced: false }));

vi.mock('@dcl/sdk/ecs', () => fakeSdkEcs());
vi.mock('@dcl/asset-packs/dist/definitions', () => import('../src/definitions'));
vi.mock('@dcl/sdk/network', () => ({ isStateSyncronized: () => network.synced }));

describe('PistonPlatform', () => {
  let ecs: ScriptEngine;
  let platform: PistonPlatformClass;
  let onDown: ReturnType<typeof vi.fn>;

  const playing = () => ecs.Animator.get(platform.entity).states.find(s => s.playing)?.clip;
  const sync = (next: string) => {
    const states = ecs.States.getMutable(platform.entity);
    states.previousValue = states.currentValue;
    states.currentValue = next;
  };

  beforeEach(async () => {
    ecs = await loadScriptEngine();
    network.synced = false;
    const { PistonPlatform } = await import(
      '../packs/smart_items/assets/lab_stair_platform/PistonPlatform'
    );
    platform = new PistonPlatform('src', ecs.engine.addEntity(), 'Up');
    platform.start();
    onDown = vi.fn();
    platform.onEvent('down', onDown);
  });

  describe('when a late joiner receives the shared position', () => {
    beforeEach(() => {
      sync('Down');
      network.synced = true;
      platform.update(0.016);
    });

    it('should snap to it without sound or events', () => {
      expect(playing()).toBe('Down');
      expect(ecs.AudioSource.getOrNull(platform.entity)).toBeNull();
      expect(onDown).not.toHaveBeenCalled();
    });
  });

  describe('when another player moves it after the state has synced', () => {
    beforeEach(() => {
      network.synced = true;
      platform.update(1.5);
      sync('Down');
      platform.update(0.016);
    });

    it('should play the move with its sound and events', () => {
      expect(playing()).toBe('UpToDown');
      expect(ecs.AudioSource.get(platform.entity).playing).toBe(true);
      expect(onDown).toHaveBeenCalledTimes(1);
    });
  });

  describe('when this player moves it before the state has synced', () => {
    beforeEach(() => {
      platform.lower();
      platform.update(0.016);
    });

    it('should play the move with its sound and events', () => {
      expect(playing()).toBe('UpToDown');
      expect(ecs.AudioSource.get(platform.entity).playing).toBe(true);
      expect(onDown).toHaveBeenCalledTimes(1);
    });
  });
});
