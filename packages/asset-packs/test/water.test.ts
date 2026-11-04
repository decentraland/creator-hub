import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Entity } from '@dcl/ecs';
import { Quaternion, Vector3 } from '@dcl/sdk/math';
import type { Water as WaterClass } from '../packs/smart_items/assets/water_plane/Water';
import { fakeSdkEcs, loadScriptEngine, type ScriptEngine } from './script-harness';

vi.mock('@dcl/sdk/ecs', () => fakeSdkEcs());

const RIPPLE_SIZE = 512 / 38;

describe('Water', () => {
  let ecs: ScriptEngine;
  let water: WaterClass;
  let group: Entity;
  let layer: Entity;

  const tiling = () => {
    const material = ecs.Material.get(layer).material;
    if (material?.$case !== 'pbr') throw new Error('layer lost its PBR material');
    const tex = material.pbr.bumpTexture?.tex;
    if (tex?.$case !== 'texture') throw new Error('layer lost its normal map');
    return tex.texture.tiling;
  };

  beforeEach(async () => {
    ecs = await loadScriptEngine();
    group = ecs.engine.addEntity();
    ecs.Transform.create(group, { scale: Vector3.create(2, 1, 2) });
    const item = ecs.engine.addEntity();
    ecs.Transform.create(item, { parent: group });
    layer = ecs.engine.addEntity();
    ecs.Transform.create(layer, {
      parent: item,
      rotation: Quaternion.fromEulerDegrees(90, 0, 0),
      scale: Vector3.create(16, 16, 1),
    });
    ecs.MeshRenderer.setPlane(layer);
    ecs.Material.setPbrMaterial(layer, {
      bumpTexture: ecs.Material.Texture.Common({ src: 'src/PoolBake_normal.png' }),
    });
    const { Water } = await import('../packs/smart_items/assets/water_plane/Water');
    water = new Water('src', item);
    water.start();
  });

  describe('when the water sits in a scaled group', () => {
    it('should size the ripples by the scale it has in the scene', () => {
      expect(tiling()).toEqual({ x: (2 * 16) / RIPPLE_SIZE, y: (2 * 16) / RIPPLE_SIZE });
    });
  });

  describe('when the group is rescaled', () => {
    beforeEach(() => {
      ecs.Transform.getMutable(group).scale = Vector3.create(4, 1, 4);
      water.update(0.016);
    });

    it('should refit the ripples', () => {
      expect(tiling()).toEqual({ x: (4 * 16) / RIPPLE_SIZE, y: (4 * 16) / RIPPLE_SIZE });
    });
  });
});
