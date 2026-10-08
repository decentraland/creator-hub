import { describe, it, expect } from 'vitest';
import { EntityType } from '@dcl/schemas';
import * as components from '@dcl/ecs/dist/components';

import type { Entity, IEngine } from '@dcl/ecs';
import { initTestEngine } from '../../../../test/data-layer/utils';

describe('[UNDO] remove entity', () => {
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

  const getName = (engine: IEngine) => components.Name(engine);
  const getTransform = (engine: IEngine) => components.Transform(engine);
  const settleAutosave = () => new Promise(resolve => setTimeout(resolve, 150));

  let entity: Entity;

  it('restores a removed entity on every engine, keeping it editable', async () => {
    const {
      inspectorEngine,
      dataLayerEngine,
      rendererEngine,
      inspectorOperations,
      dataLayer,
      tick,
    } = context;
    await dataLayerEngine.update(1);
    await tick();
    await settleAutosave();

    entity = inspectorOperations.addChild(0 as Entity, 'Fantasy Chest');
    await inspectorOperations.dispatch();
    await tick();
    await settleAutosave();
    expect(getName(dataLayerEngine).get(entity).value).toBe('Fantasy Chest');
    expect(getTransform(rendererEngine).has(entity)).toBe(true);

    inspectorOperations.removeEntity(entity);
    await inspectorOperations.dispatch();
    await tick();
    await settleAutosave();
    expect(getName(inspectorEngine).getOrNull(entity)).toBe(null);

    await dataLayer.undo({});
    await tick();

    expect(getName(dataLayerEngine).getOrNull(entity)?.value).toBe('Fantasy Chest');
    expect(getName(inspectorEngine).getOrNull(entity)?.value).toBe('Fantasy Chest');
    expect(getTransform(rendererEngine).has(entity)).toBe(true);
  });

  it('propagates a later edit of the restored entity to the data layer', async () => {
    const { inspectorEngine, dataLayerEngine, inspectorOperations, tick } = context;
    await settleAutosave();

    inspectorOperations.updateValue(getName(inspectorEngine), entity, { value: 'Treasure Chest' });
    await inspectorOperations.dispatch();
    await tick();

    expect(getName(dataLayerEngine).getOrNull(entity)?.value).toBe('Treasure Chest');
  });
});
