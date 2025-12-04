import type { Entity, IEngine } from '@dcl/ecs';
import { Color4, Quaternion } from '@dcl/sdk/math';
import type { EngineComponents } from './definitions';
import { getComponents } from './definitions';

const bars = new Map<Entity, Entity>();
const backgrounds = new Map<Entity, Entity>();

const SCALE = 1;

export function createCounterBarSystem(engine: IEngine, components: EngineComponents) {
  const { Material, MeshRenderer, Transform, Billboard } = components;
  const { Counter, CounterBar } = getComponents(engine);
  return function counterBarSystem() {
    for (const [
      entity,
      { value: _value },
      { primaryColor, secondaryColor, maxValue },
    ] of engine.getEntitiesWith(Counter, CounterBar)) {
      if (!bars.has(entity)) {
        const primary = primaryColor ? Color4.fromHexString(primaryColor) : Color4.Green();
        const seconday = secondaryColor ? Color4.fromHexString(secondaryColor) : Color4.Red();

        const container = engine.addEntity();
        Transform.create(container, { parent: entity });
        Billboard.create(container);

        const bar = engine.addEntity();
        bars.set(entity, bar);
        Material.setBasicMaterial(bar, {
          diffuseColor: primary,
        });
        MeshRenderer.setCylinder(bar);
        Transform.create(bar, {
          position: { x: 0, y: 0, z: 0 },
          scale: { x: 0.1 * SCALE, y: 1 * SCALE, z: 0.1 * SCALE },
          rotation: Quaternion.fromEulerDegrees(0, 0, 90),
          parent: container,
        });

        const background = engine.addEntity();
        backgrounds.set(entity, background);
        Material.setBasicMaterial(background, {
          diffuseColor: seconday,
        });
        MeshRenderer.setCylinder(background);
        Transform.create(background, {
          position: { x: 0, y: 0, z: 0 },
          scale: { x: 0.09 * SCALE, y: 1 * SCALE, z: 0.09 * SCALE },
          rotation: Quaternion.fromEulerDegrees(0, 0, 90),
          parent: container,
        });

        const entityTransform = Transform.getMutableOrNull(entity);
        if (entityTransform) {
          if (entityTransform.parent === engine.PlayerEntity) {
            entityTransform.position = { x: 0, y: 2.1, z: 0 };
            entityTransform.scale = { x: 0.5, y: 0.5, z: 0.5 };
          } else if (entityTransform.parent === engine.CameraEntity) {
            entityTransform.position = { x: 0, y: 0.5, z: 1 };
            entityTransform.scale = { x: 0.5, y: 0.5, z: 0.5 };
          }
        }
      }

      const max = maxValue || 10;

      const counter = Counter.getMutable(entity);
      if (counter.value > max) {
        counter.value = max;
      }
      if (counter.value < 0) {
        counter.value = 0;
      }
      const currentValue = Math.max(Math.min(counter.value / max, 1), 0) / (1 / SCALE); // 0.75
      const bar = bars.get(entity)!;
      const background = backgrounds.get(entity)!;
      const barTransform = Transform.getMutable(bar);
      barTransform.position.x = (currentValue - SCALE) / 2; // -0.125
      barTransform.scale.y = currentValue;

      const backgroundTransform = Transform.getMutable(background);
      backgroundTransform.position.x = SCALE / 2 + barTransform.position.x;
      backgroundTransform.scale.y = SCALE - currentValue;
    }
  };
}
