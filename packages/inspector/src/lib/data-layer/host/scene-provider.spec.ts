import type { LastWriteWinElementSetComponentDefinition, OnChangeFunction } from '@dcl/ecs';
import { ReadWriteByteBuffer } from '@dcl/ecs/dist/serialization/ByteBuffer';
import { feededFileSystem } from '../client/feeded-local-fs';
import type { EditorComponentsTypes } from '../../sdk/components';
import { EditorComponentNames } from '../../sdk/components';
import { initRpcMethods } from './rpc-methods';
import { createEngineContext } from './utils/engine';

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

async function readSceneJson(fs: Awaited<ReturnType<typeof feededFileSystem>>) {
  const buffer = await fs.readFile('scene.json');
  return JSON.parse(new TextDecoder().decode(buffer));
}

// The UI engine talks to the data-layer engine through CRDT binary serialization,
// which can drop values the in-memory object would keep (e.g. Schemas.Optional
// serializes falsy values as "not present"). Round-tripping here ensures the test
// exercises the same constraints as the real transport.
function serializationRoundTrip<T>(
  component: LastWriteWinElementSetComponentDefinition<T>,
  value: T,
): T {
  const buffer = new ReadWriteByteBuffer();
  component.schema.serialize(value as Parameters<typeof component.schema.serialize>[0], buffer);
  return component.schema.deserialize(buffer) as T;
}

describe('SceneProvider', () => {
  const originalError = console.error;
  const originalFetch = globalThis.fetch;
  beforeEach(() => {
    console.error = () => {};
    (globalThis as any).fetch = () => {
      throw new Error('Fetch is mocked inside the tests');
    };
  });
  afterAll(() => {
    console.error = originalError;
    (globalThis as any).fetch = originalFetch;
  });

  describe('when toggling hideLandscapeTerrain on the Scene component', () => {
    it('should persist landscapeTerrain false into scene.json and restore it on re-enable', async () => {
      const mocked = await mockedRpcInit();
      await initRpcMethods(mocked.fs, mocked.engine, mocked.addEngineListener);

      const Scene = mocked.engine.getComponent(
        EditorComponentNames.Scene,
      ) as LastWriteWinElementSetComponentDefinition<EditorComponentsTypes['Scene']>;

      const current = Scene.get(mocked.engine.RootEntity);
      Scene.createOrReplace(
        mocked.engine.RootEntity,
        serializationRoundTrip(Scene, { ...current, hideLandscapeTerrain: true }),
      );
      await mocked.engine.update(1);
      // state-manager batches operations with setTimeout(0) and saving is async
      await new Promise(resolve => setTimeout(resolve, 50));

      const sceneJson = await readSceneJson(mocked.fs);
      expect(sceneJson.landscapeTerrain).toBe(false);

      const updated = Scene.get(mocked.engine.RootEntity);
      Scene.createOrReplace(
        mocked.engine.RootEntity,
        serializationRoundTrip(Scene, { ...updated, hideLandscapeTerrain: false }),
      );
      await mocked.engine.update(1);
      await new Promise(resolve => setTimeout(resolve, 50));

      const sceneJsonAfter = await readSceneJson(mocked.fs);
      expect(sceneJsonAfter.landscapeTerrain).toBe(true);
    });
  });
});
