import type { OnChangeFunction } from '@dcl/ecs';
import { Composite, Schemas, Name, Transform } from '@dcl/ecs';
import { feededFileSystem } from '../client/feeded-local-fs';
import { initRpcMethods } from './rpc-methods';
import { createEngineContext } from './utils/engine';
import { dumpEngineToComposite } from './utils/engine-to-composite';
import { getCurrentCompositePath } from './fs-utils';

async function mockedRpcInit() {
  const callbackFunctions: OnChangeFunction[] = [];
  const fs = await feededFileSystem();
  const engineContext = createEngineContext({
    onChangeFunction: (entity, operation, component, componentValue) => {
      callbackFunctions.forEach(func => func(entity, operation, component, componentValue));
    },
  });
  const engine = engineContext.engine;

  const addEngineListener = (fn: OnChangeFunction) => {
    callbackFunctions.push(fn);
  };

  return { fs, engine, addEngineListener };
}

describe('Init RPC Methods', () => {
  const originalError = console.error;
  const originalFetch = globalThis.fetch;
  beforeEach(async () => {
    console.error = () => {};
    (globalThis as any).fetch = () => {
      throw new Error('Fetch is mocked inside the tests');
    };
  });
  afterAll(() => {
    console.error = originalError;
    (globalThis as any).fetch = originalFetch;
  });

  it('should return default inspector preferences', async () => {
    const mocked = await mockedRpcInit();
    const methods = await initRpcMethods(mocked.fs, mocked.engine, mocked.addEngineListener);
    expect(await methods.getInspectorPreferences()).toMatchObject({
      freeCameraInvertRotation: false,
      autosaveEnabled: true,
    });
  });

  it('should create a legacy entity node and create the Name component instead', async () => {
    const mocked = await mockedRpcInit();
    const tempContext = createEngineContext();

    const LegacyEntityNode = tempContext.engine.defineComponent('inspector::EntityNode', {
      label: Schemas.String,
      parent: Schemas.Number,
    });
    const entity = tempContext.engine.addEntity();
    LegacyEntityNode.create(entity, { label: 'Boedo', parent: 10 });
    const composite = dumpEngineToComposite(tempContext.engine, 'json');
    const jsonComposite = Composite.toJson(composite);
    const compositeDest = getCurrentCompositePath();
    await mocked.fs.writeFile(compositeDest, Buffer.from(JSON.stringify(jsonComposite), 'utf-8'));
    await initRpcMethods(mocked.fs, mocked.engine, mocked.addEngineListener);

    // After migration, the legacy EntityNode component should be removed
    const EntityNodeComponent = mocked.engine.getComponentOrNull('inspector::EntityNode');
    expect(EntityNodeComponent).toBeNull();

    // And the entity should have Name and Transform components instead
    const NameComponent = mocked.engine.getComponent(Name.componentId) as typeof Name;
    const TransformComponent = mocked.engine.getComponent(
      Transform.componentId,
    ) as typeof Transform;

    // Find the migrated entity by its Name component value
    const entitiesWithName = Array.from(mocked.engine.getEntitiesWith(NameComponent));
    const entityWithBoedo = entitiesWithName.find(([_, nameValue]) => nameValue.value === 'Boedo');
    expect(entityWithBoedo).toBeDefined();
    const [migratedEntity] = entityWithBoedo!;
    expect(NameComponent.get(migratedEntity)).toMatchObject({ value: 'Boedo' });
    expect(TransformComponent.get(migratedEntity).parent).toBe(10);
    expect(mocked.engine.getComponentOrNull('inspector::EntityNode')).toBe(null);

    await mocked.engine.update(1);
  });
});
