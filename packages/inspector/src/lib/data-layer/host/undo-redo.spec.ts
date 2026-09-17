import { describe, it, expect } from 'vitest';
import { EntityType } from '@dcl/schemas';
import * as components from '@dcl/ecs/dist/components';

import type { Entity, IEngine } from '@dcl/ecs';
import { initTestEngine } from '../../../../test/data-layer/utils';

describe('[UNDO] Inspector<->DataLayer<->Babylon', () => {
  const context = initTestEngine({
    baseUrl: '/',
    entity: {
      content: [],
      metadata: {},
      version: 'v3',
      type: EntityType.SCENE,
      timestamp: 1,
      pointers: ['0, 0'],
    },
    id: '123',
  });
  function getTransform(engine: IEngine) {
    const Transform = components.Transform(engine);
    return Transform;
  }
  function getGLTFContainer(engine: IEngine) {
    const GltfContainer = components.GltfContainer(engine);
    return GltfContainer;
  }
  let cachedEntity: Entity;

  it('initialize dataLayer composite and send it to inspector', async () => {
    const { dataLayerEngine, tick } = context;
    await dataLayerEngine.update(1);
    await tick();
  });

  it('creates a new entity with a Transform component', async () => {
    const { inspectorEngine, dataLayerEngine, inspectorOperations, tick } = context;
    const Transform = getTransform(inspectorEngine);
    const entity = (cachedEntity = inspectorEngine.addEntity());
    inspectorOperations.addComponent(entity, Transform.componentId);
    inspectorOperations.updateValue(Transform, entity, { position: { x: 8, y: 8, z: 8 } });

    await inspectorOperations.dispatch();
    await tick();
    expect(getTransform(dataLayerEngine).get(entity).position).toMatchObject({ x: 8, y: 8, z: 8 });
    expect(getTransform(inspectorEngine).get(entity).position).toMatchObject({ x: 8, y: 8, z: 8 });
  });

  it('modifies the Transform component', async () => {
    const { inspectorEngine, dataLayerEngine, inspectorOperations, tick } = context;
    const Transform = getTransform(inspectorEngine);
    inspectorOperations.updateValue(Transform, cachedEntity, { position: { x: 9, y: 8, z: 8 } });
    await inspectorOperations.dispatch();
    await tick();
    // Do NOT sleep here. The next test undoes this edit AND the creation above in
    // ONE step, which only holds while both land inside the provider's 100ms
    // deferred-grouping window (`startDeferredMode`). A sleep spends that window
    // instead of helping — the assertions below read state that is already
    // applied. NOTE this test is still wall-clock dependent even without it: the
    // whole three-test sequence has to fit in those 100ms, so it flakes under a
    // loaded test runner. Removing the sleep widens the margin; it does not fix
    // the underlying race.
    expect(getTransform(dataLayerEngine).get(cachedEntity).position.x).toBe(9);
    expect(getTransform(inspectorEngine).get(cachedEntity).position.x).toBe(9);
  });

  it('undo the transform update (8 -> 9)', async () => {
    const { inspectorEngine, dataLayer, tick } = context;
    await dataLayer.undo({});
    await tick();
    expect(getTransform(inspectorEngine).has(cachedEntity)).toBe(false);
  });
  it('undo the create transform operation, so the transform now will be deleted', async () => {
    const { inspectorEngine, dataLayer, tick } = context;
    await dataLayer.undo({});
    await tick();
    expect(getTransform(inspectorEngine).getOrNull(cachedEntity)).toBe(null);
  });

  it('redo and create the transform again', async () => {
    const { inspectorEngine, dataLayer, tick } = context;
    await dataLayer.redo({});
    await tick();
    expect(getTransform(inspectorEngine).get(cachedEntity).position).toMatchObject({
      x: 8,
      y: 8,
      z: 8,
    });
  });

  it('generates a new component', async () => {
    const { inspectorEngine, inspectorOperations, tick } = context;
    const Transform = getTransform(inspectorEngine);
    const entity = inspectorEngine.addEntity();
    inspectorOperations.addComponent(entity, Transform.componentId);
    inspectorOperations.updateValue(Transform, entity, { position: { x: 9, y: 8, z: 8 } });
    await inspectorOperations.dispatch();
    await tick();
  });

  it('should clean the redoList.', async () => {
    const { inspectorEngine, dataLayer, tick } = context;
    await dataLayer.redo({});
    await tick();

    // Nothing done
    expect(getTransform(inspectorEngine).get(cachedEntity).position.x).toBe(8);
  });
  it('should create an entity with multiple components', async () => {
    const { inspectorEngine, dataLayerEngine, rendererEngine, inspectorOperations, tick } = context;
    const entity = (cachedEntity = inspectorOperations.addAsset(
      0 as Entity,
      'boedo/casla',
      'boedo',
      {
        x: 8,
        y: 8,
        z: 8,
      },
      '',
      {} as any,
    ));
    await inspectorOperations.dispatch();
    await tick();
    expect(getTransform(dataLayerEngine).get(entity).position).toMatchObject({ x: 8, y: 8, z: 8 });
    expect(getTransform(inspectorEngine).get(entity).position).toMatchObject({ x: 8, y: 8, z: 8 });
    expect(getTransform(rendererEngine).get(entity).position).toMatchObject({ x: 8, y: 8, z: 8 });
    expect(getGLTFContainer(dataLayerEngine).has(entity)).toBe(true);
    expect(getGLTFContainer(inspectorEngine).has(entity)).toBe(true);
    expect(getGLTFContainer(rendererEngine).has(entity)).toBe(true);
  });
  it('should remove all components at once when undo the previous action', async () => {
    const { inspectorEngine, dataLayer, rendererEngine, dataLayerEngine, tick } = context;
    await dataLayer.undo({});
    await tick();
    expect(getTransform(dataLayerEngine).has(cachedEntity)).toBe(false);
    expect(getTransform(inspectorEngine).has(cachedEntity)).toBe(false);
    expect(getTransform(rendererEngine).has(cachedEntity)).toBe(false);
    expect(getGLTFContainer(dataLayerEngine).has(cachedEntity)).toBe(false);
    expect(getGLTFContainer(inspectorEngine).has(cachedEntity)).toBe(false);
    expect(getGLTFContainer(rendererEngine).has(cachedEntity)).toBe(false);
  });
});
