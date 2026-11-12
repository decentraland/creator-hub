import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Entity } from '@dcl/ecs';
import type { SkyboxController as SkyboxControllerClass } from '../packs/smart_items/assets/skybox/skybox-controller';
import { fakeSdkEcs } from './script-harness';

// Skybox, Sun and EnvironmentFog arrived in SDK 7.33, newer than the @dcl/ecs this package installs,
// so the test stands them in with a store of the last value written to each entity.
function fakeComponent() {
  const values = new Map<Entity, any>();
  return {
    values,
    createOrReplace: (entity: Entity, value: unknown) => values.set(entity, value),
    deleteFrom: (entity: Entity) => values.delete(entity),
  };
}

const components = vi.hoisted(() => ({}) as Record<string, ReturnType<typeof fakeComponent>>);

vi.mock('@dcl/sdk/ecs', async () => {
  components.Skybox = fakeComponent();
  components.Sun = fakeComponent();
  components.EnvironmentFog = fakeComponent();
  return { ...(await fakeSdkEcs()), ...components };
});

describe('SkyboxController', () => {
  let root: Entity;
  let SkyboxController: typeof SkyboxControllerClass;

  const sky = () => components.Skybox.values.get(root);
  const sun = () => components.Sun.values.get(root);
  const fog = () => components.EnvironmentFog.values.get(root);
  const create = (...params: unknown[]) =>
    new (SkyboxController as any)('src', 512 as Entity, ...params) as SkyboxControllerClass;

  beforeEach(async () => {
    const ecs = await import('@dcl/sdk/ecs');
    root = ecs.engine.RootEntity;
    for (const component of Object.values(components)) component.values.clear();
    ({ SkyboxController } = await import('../packs/smart_items/assets/skybox/skybox-controller'));
  });

  describe('when it starts with the default settings', () => {
    let skybox: SkyboxControllerClass;

    beforeEach(() => {
      skybox = create();
      skybox.start();
    });

    it('should write the sky colours as single-key gradients on the scene root', () => {
      expect(sky().skyColors.zenith.keys).toHaveLength(1);
      expect(sky().skyColors.zenith.keys[0].time).toBe(0);
    });

    it('should send the picked colours unchanged', () => {
      expect(sky().skyColors.zenith.keys[0].color.r).toBeCloseTo(0x30 / 255, 6);
    });

    it('should draw the clouds twice as bright as the picked colour', () => {
      expect(sky().clouds.color.keys[0].color.b).toBeCloseTo(2, 6);
    });

    it('should set the clouds, stars and fog as the regular sky has them', () => {
      expect(sky().clouds).toMatchObject({ opacity: 1, speed: 0.01 });
      expect(sky().stars).toEqual({ brightness: 4.62 });
      expect(fog()).toMatchObject({ density: 0.0005 });
    });

    it('should leave the sun alone', () => {
      expect(sun()).toBeUndefined();
    });

    it('should keep the procedural sky, with no texture', () => {
      expect(sky().skyboxTexture).toBeUndefined();
    });
  });

  describe('when a skybox texture is picked', () => {
    it('should send its path, which the explorer draws in place of the sky', () => {
      const skybox = create();
      skybox.skyboxTexture = ' assets/scene/Images/sky.png ';
      skybox.start();
      expect(sky().skyboxTexture).toBe('assets/scene/Images/sky.png');
    });

    // The ambient light follows the sky colours even under a texture.
    it('should still send the sky colours', () => {
      const skybox = create();
      skybox.skyboxTexture = 'assets/scene/Images/sky.png';
      skybox.start();
      expect(sky().skyColors.zenith).toBeDefined();
    });
  });

  describe('when it is set not to start enabled', () => {
    it('should write nothing until it is enabled', () => {
      const skybox = create(false);
      skybox.start();
      expect(sky()).toBeUndefined();
      skybox.enable();
      expect(sky()).toBeDefined();
    });
  });

  describe('when it is disabled', () => {
    it('should remove the sky, sun and fog overrides', () => {
      const skybox = create();
      skybox.sunIntensity = 0.5;
      skybox.start();
      skybox.disable();
      expect([sky(), sun(), fog()]).toEqual([undefined, undefined, undefined]);
    });
  });

  describe('when it is toggled twice', () => {
    it('should turn the overrides off and then on again', () => {
      const skybox = create();
      skybox.start();
      skybox.toggle();
      expect(sky()).toBeUndefined();
      skybox.toggle();
      expect(sky()).toBeDefined();
    });
  });

  describe('when the clouds are hidden and shown again', () => {
    it('should set their opacity to 0 and then back to the configured value', () => {
      const skybox = create();
      skybox.cloudOpacity = 0.4;
      skybox.start();
      skybox.hideClouds();
      expect(sky().clouds.opacity).toBe(0);
      skybox.showClouds();
      expect(sky().clouds.opacity).toBe(0.4);
    });
  });

  describe('when the fog is cleared while the item is disabled', () => {
    it('should apply the cleared fog once enabled', () => {
      const skybox = create(false);
      skybox.start();
      skybox.clearFog();
      expect(fog()).toBeUndefined();
      skybox.enable();
      expect(fog().density).toBe(0);
      skybox.restoreFog();
      expect(fog().density).toBe(0.0005);
    });
  });

  describe('when the fog is cleared without custom fog', () => {
    it('should only override the density', () => {
      const skybox = create();
      skybox.customFog = false;
      skybox.start();
      expect(fog()).toBeUndefined();
      skybox.clearFog();
      expect(fog()).toEqual({ color: undefined, density: 0 });
    });
  });

  describe('when the custom sky colours are turned off', () => {
    it('should leave the sky and cloud colours to the time of day', () => {
      const skybox = create();
      skybox.customSkyColors = false;
      skybox.start();
      expect(sky().skyColors).toBeUndefined();
      expect(sky().clouds.color).toBeUndefined();
    });
  });

  describe('when the ambient brightness is 0', () => {
    it('should turn the sky, clouds and fog black', () => {
      const skybox = create();
      skybox.ambientBrightness = 0;
      skybox.start();
      const colors = [
        sky().skyColors.zenith,
        sky().skyColors.horizon,
        sky().skyColors.rim,
        sky().skyColors.nadir,
        sky().clouds.color,
        fog().color,
      ].map(gradient => gradient.keys[0].color);
      expect(colors).toEqual(Array(6).fill({ r: 0, g: 0, b: 0, a: 1 }));
    });
  });

  describe('when the ambient brightness is lowered with the custom sky colours and fog off', () => {
    let skybox: SkyboxControllerClass;

    beforeEach(() => {
      skybox = create();
      skybox.customSkyColors = false;
      skybox.customFog = false;
      skybox.ambientBrightness = 0.5;
      skybox.zenithColor = { r: 1, g: 1, b: 1 };
      skybox.fogColor = { r: 1, g: 0, b: 1 };
      skybox.start();
    });

    // The colour fields are locked in the editor while their Custom option is off, so they must
    // not reach the scene: darkening scales the regular midday colours instead.
    it('should darken the regular sky colours, not the locked ones', () => {
      expect(sky().skyColors.zenith.keys[0].color).toEqual({
        r: (0x30 / 255) * 0.5,
        g: (0x99 / 255) * 0.5,
        b: (0xee / 255) * 0.5,
        a: 1,
      });
    });

    it('should darken the regular cloud colour', () => {
      expect(sky().clouds.color.keys[0].color).toEqual({
        r: (0xb5 / 255) * 0.5 * 2,
        g: (0xe5 / 255) * 0.5 * 2,
        b: (0xff / 255) * 0.5 * 2,
        a: 1,
      });
    });

    it('should darken the regular fog colour and keep the regular density', () => {
      expect(fog()).toEqual({
        color: {
          keys: [
            {
              time: 0,
              color: { r: (0x50 / 255) * 0.5, g: (0x8e / 255) * 0.5, b: (0xb4 / 255) * 0.5, a: 1 },
            },
          ],
        },
        density: undefined,
      });
    });
  });

  describe('when a colour arrives as a hex code typed in a text box', () => {
    it('should read it with or without the leading #', () => {
      const skybox = create();
      (skybox as any).zenithColor = '#FFFFFF';
      (skybox as any).fogColor = ' 000000 ';
      skybox.start();
      expect(sky().skyColors.zenith.keys[0].color).toEqual({ r: 1, g: 1, b: 1, a: 1 });
      expect(fog().color.keys[0].color).toEqual({ r: 0, g: 0, b: 0, a: 1 });
    });
  });

  describe('when the sun intensity is turned down', () => {
    it('should override only the intensity', () => {
      const skybox = create();
      skybox.sunIntensity = 0;
      skybox.start();
      expect(sun()).toEqual({
        color: undefined,
        intensity: 0,
        visible: true,
        direction: undefined,
      });
    });
  });

  describe('when the sun colour is customised', () => {
    it('should send the picked colour', () => {
      const skybox = create();
      skybox.customSunColor = true;
      skybox.sunColor = { r: 1, g: 0.5, b: 0 };
      skybox.start();
      expect(sun().color.keys[0].color).toEqual({ r: 1, g: 0.5, b: 0, a: 1 });
    });
  });

  describe('when the sun position is fixed', () => {
    it('should point the light away from the sun', () => {
      const skybox = create();
      skybox.fixSunPosition = true;
      skybox.sunHeight = 90;
      skybox.start();
      const { x, y, z } = sun().direction;
      expect([x, y, z].map(v => Math.round(v * 1000) / 1000 + 0)).toEqual([0, -1, 0]);
    });

    it('should shine from the chosen compass direction', () => {
      const skybox = create();
      skybox.fixSunPosition = true;
      skybox.sunHeight = 0;
      skybox.sunDirection = 90;
      skybox.start();
      // a sun in the east (+X) sends its light towards -X
      expect(sun().direction.x).toBeCloseTo(-1);
    });
  });
});
