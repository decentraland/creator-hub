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
  // The undo provider reads an edit's previous value from the LAST DUMPED composite, and the
  // composite provider skips dumps closer than its 100ms autosave interval. Letting that
  // interval pass before each edit keeps every undo entry exact, so the edits below undo one
  // at a time instead of collapsing into the neighbour's entry.
  const settleAutosave = () => new Promise(resolve => setTimeout(resolve, 150));

  it('initialize dataLayer composite and send it to inspector', async () => {
    const { dataLayerEngine, tick } = context;
    await dataLayerEngine.update(1);
    await tick();
  });

  it('creates a new entity with a Transform component', async () => {
    const { inspectorEngine, dataLayerEngine, inspectorOperations, tick } = context;
    await settleAutosave();
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
    await settleAutosave();
    const Transform = getTransform(inspectorEngine);
    inspectorOperations.updateValue(Transform, cachedEntity, { position: { x: 9, y: 8, z: 8 } });
    await inspectorOperations.dispatch();
    await tick();
    expect(getTransform(dataLayerEngine).get(cachedEntity).position.x).toBe(9);
    expect(getTransform(inspectorEngine).get(cachedEntity).position.x).toBe(9);
  });

  it('undo the transform update (9 -> 8)', async () => {
    const { inspectorEngine, dataLayer, tick } = context;
    await settleAutosave();
    await dataLayer.undo({});
    await tick();
    expect(getTransform(inspectorEngine).get(cachedEntity).position.x).toBe(8);
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

  it('should undo a large single operation (300+ components) in ONE step (#1460)', async () => {
    // A single operation whose synchronous change burst is large (e.g. adding a
    // multi-entity composite) must remain one atomic undo entry. Previously the state
    // manager force-committed mid-burst at 200 ops, which set `processing` and dropped
    // the rest of the burst from undo capture — so one Ctrl+Z reverted only part and
    // left orphaned entities in the scene files/preview.
    const { inspectorEngine, dataLayerEngine, inspectorOperations, dataLayer, tick } = context;
    const Transform = getTransform(inspectorEngine);
    const bulkEntities: Entity[] = [];
    for (let i = 0; i < 300; i++) {
      const entity = inspectorEngine.addEntity();
      bulkEntities.push(entity);
      Transform.create(entity, { position: { x: i, y: 0, z: 0 } });
    }
    await inspectorOperations.dispatch();
    await tick();
    expect(bulkEntities.every(e => getTransform(dataLayerEngine).has(e))).toBe(true);

    await dataLayer.undo({});
    await tick();
    // A single undo removes ALL of them — the whole burst is one entry, nothing dropped.
    expect(bulkEntities.some(e => getTransform(dataLayerEngine).has(e))).toBe(false);
  });
});
