import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Entity } from '@dcl/ecs';
import type { FloorButton as FloorButtonClass } from '../packs/smart_items/assets/floor_pressure_button/FloorButton';
import { fakeSdkEcs, fire, loadScriptEngine, type ScriptEngine } from './script-harness';

vi.mock('@dcl/sdk/ecs', () => fakeSdkEcs());
vi.mock('@dcl/asset-packs/dist/definitions', () => import('../src/definitions'));

describe('FloorButton', () => {
  let ecs: ScriptEngine;
  let button: FloorButtonClass;
  let other: Entity;
  let onPress: ReturnType<typeof vi.fn>;
  let onRelease: ReturnType<typeof vi.fn>;

  const value = () => ecs.States.get(button.entity).currentValue;
  const sync = (next: string) => {
    const states = ecs.States.getMutable(button.entity);
    states.previousValue = states.currentValue;
    states.currentValue = next;
  };
  const wait = (seconds: number) => {
    for (let t = 0; t < seconds; t += 0.1) button.update(0.1);
  };

  beforeEach(async () => {
    ecs = await loadScriptEngine();
    ecs.PlayerIdentityData.create(ecs.engine.PlayerEntity, { address: '0xbbb', isGuest: false });
    other = ecs.engine.addEntity();
    ecs.PlayerIdentityData.create(other, { address: '0xaaa', isGuest: false });
    onPress = vi.fn();
    onRelease = vi.fn();
    const { FloorButton } = await import(
      '../packs/smart_items/assets/floor_pressure_button/FloorButton'
    );
    button = new FloorButton('src', ecs.engine.addEntity(), 'all players', onPress, onRelease);
    button.start();
  });

  describe('when this player steps on and off alone', () => {
    beforeEach(() => {
      fire('enter', ecs.engine.PlayerEntity);
      wait(0.2);
      fire('exit', ecs.engine.PlayerEntity);
      wait(2);
    });

    it('should run On Press and On Release once each', () => {
      expect(onPress).toHaveBeenCalledTimes(1);
      expect(onRelease).toHaveBeenCalledTimes(1);
      expect(value()).toBe('Released');
    });
  });

  describe('when both players step off within the network lag', () => {
    beforeEach(() => {
      fire('enter', other);
      sync('Pressed');
      fire('enter', ecs.engine.PlayerEntity);
      wait(0.2);
      fire('exit', ecs.engine.PlayerEntity);
      fire('exit', other);
    });

    describe('and the other client never released it', () => {
      beforeEach(() => wait(2));

      it('should run On Release once and release the shared state', () => {
        expect(onRelease).toHaveBeenCalledTimes(1);
        expect(value()).toBe('Released');
      });
    });

    describe("and the other client's release arrives first", () => {
      beforeEach(() => {
        wait(0.3);
        sync('Released');
        wait(2);
      });

      it('should leave On Release to that client', () => {
        expect(onRelease).not.toHaveBeenCalled();
      });
    });
  });

  describe('when another player released it while this player stood on it', () => {
    beforeEach(() => {
      fire('enter', other);
      sync('Pressed');
      fire('enter', ecs.engine.PlayerEntity);
      sync('Released');
      fire('exit', other);
      wait(2);
    });

    it('should press it again and run On Press once', () => {
      expect(onPress).toHaveBeenCalledTimes(1);
      expect(value()).toBe('Pressed');
    });
  });

  describe('when this player only watched another player use it', () => {
    beforeEach(() => {
      fire('enter', other);
      sync('Pressed');
      wait(0.2);
      fire('exit', other);
      wait(2);
    });

    it('should not run any action', () => {
      expect(onPress).not.toHaveBeenCalled();
      expect(onRelease).not.toHaveBeenCalled();
    });
  });

  describe("when a remote avatar's enter arrives before its identity", () => {
    let late: Entity;

    beforeEach(() => {
      late = ecs.engine.addEntity();
      fire('enter', late);
      wait(0.1);
      ecs.PlayerIdentityData.create(late, { address: '0xccc', isGuest: false });
      wait(0.1);
      fire('enter', ecs.engine.PlayerEntity);
      fire('exit', ecs.engine.PlayerEntity);
      wait(0.1);
    });

    it('should count that avatar once its identity arrives', () => {
      expect(onPress).toHaveBeenCalledTimes(1);
      expect(onRelease).not.toHaveBeenCalled();
      expect(value()).toBe('Pressed');
    });
  });

  describe("when it reacts only to this player's own avatar", () => {
    beforeEach(async () => {
      ecs = await loadScriptEngine();
      ecs.PlayerIdentityData.create(ecs.engine.PlayerEntity, { address: '0xbbb', isGuest: false });
      const { FloorButton } = await import(
        '../packs/smart_items/assets/floor_pressure_button/FloorButton'
      );
      button = new FloorButton('src', ecs.engine.addEntity(), 'my player', onPress, onRelease);
      button.start();
      fire('enter', other);
      fire('enter', ecs.engine.PlayerEntity);
      fire('exit', ecs.engine.PlayerEntity);
      wait(2);
    });

    it('should ignore other players and keep its state off the network', () => {
      expect(onPress).toHaveBeenCalledTimes(1);
      expect(onRelease).toHaveBeenCalledTimes(1);
      expect(ecs.States.getOrNull(button.entity)).toBeNull();
    });
  });

  describe('when the Press action holds it and a player steps on and off', () => {
    beforeEach(() => {
      button.press();
      fire('enter', ecs.engine.PlayerEntity);
      fire('exit', ecs.engine.PlayerEntity);
      wait(2);
    });

    it('should stay held until Release is called', () => {
      expect(onPress).toHaveBeenCalledTimes(1);
      expect(onRelease).not.toHaveBeenCalled();
      button.release();
      expect(onRelease).toHaveBeenCalledTimes(1);
      expect(value()).toBe('Released');
    });
  });
});
