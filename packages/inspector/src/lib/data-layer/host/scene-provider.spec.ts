import type { LastWriteWinElementSetComponentDefinition, OnChangeFunction } from '@dcl/ecs';
import { ReadWriteByteBuffer } from '@dcl/ecs/dist/serialization/ByteBuffer';
import { feededFileSystem } from '../client/feeded-local-fs';
import type { EditorComponentsTypes } from '../../sdk/components';
import type * as ConfigModule from '../../logic/config';
import { EditorComponentNames } from '../../sdk/components';
import { initRpcMethods } from './rpc-methods';
import { createEngineContext } from './utils/engine';

vi.mock('../../logic/config', async orig => {
  const actual = await orig<typeof ConfigModule>();
  return {
    ...actual,
    getConfig: () => ({ ...actual.getConfig(), authServerSupported: true }),
  };
});

async function mockedRpcInit() {
  const callbackFunctions: OnChangeFunction[] = [];
  const { fs } = await feededFileSystem();
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

async function readSceneJson(fs: Awaited<ReturnType<typeof feededFileSystem>>['fs']) {
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

/** Makes writes to one path fail until `stop()` is called. */
function breakWritesTo(
  fs: Awaited<ReturnType<typeof feededFileSystem>>['fs'],
  path: string,
  message: string,
) {
  const original = fs.writeFile;
  let broken = true;

  fs.writeFile = async (target: string, content: Buffer) => {
    if (broken && target === path) throw new Error(message);
    return original(target, content);
  };

  return {
    stop() {
      broken = false;
      fs.writeFile = original;
    },
  };
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

  describe('when toggling multiplayerServer on the Scene component', () => {
    it('should persist the allowlist into scene.json and remove it when the switch-off patch clears it', async () => {
      const mocked = await mockedRpcInit();
      await initRpcMethods(mocked.fs, mocked.engine, mocked.addEngineListener);

      const Scene = mocked.engine.getComponent(
        EditorComponentNames.Scene,
      ) as LastWriteWinElementSetComponentDefinition<EditorComponentsTypes['Scene']>;

      const addresses = [
        '0x0000000000000000000000000000000000000001',
        '0x0000000000000000000000000000000000000002',
      ];
      const current = Scene.get(mocked.engine.RootEntity);
      Scene.createOrReplace(
        mocked.engine.RootEntity,
        serializationRoundTrip(Scene, {
          ...current,
          multiplayerServer: true,
          logsPermissions: addresses,
        }),
      );
      await mocked.engine.update(1);
      // state-manager batches operations with setTimeout(0) and saving is async
      await new Promise(resolve => setTimeout(resolve, 50));

      const sceneJson = await readSceneJson(mocked.fs);
      expect(sceneJson.authoritativeMultiplayer).toBe(true);
      expect(sceneJson.logsPermissions).toEqual(addresses);

      const updated = Scene.get(mocked.engine.RootEntity);
      Scene.createOrReplace(
        mocked.engine.RootEntity,
        serializationRoundTrip(Scene, {
          ...updated,
          multiplayerServer: false,
          logsPermissions: [],
        }),
      );
      await mocked.engine.update(1);
      await new Promise(resolve => setTimeout(resolve, 50));

      const sceneJsonAfter = await readSceneJson(mocked.fs);
      expect(sceneJsonAfter.authoritativeMultiplayer).toBe(false);
      expect('logsPermissions' in sceneJsonAfter).toBe(false);
    });

    it('should keep the allowlist when multiplayerServer is switched off without clearing it', async () => {
      const mocked = await mockedRpcInit();
      await initRpcMethods(mocked.fs, mocked.engine, mocked.addEngineListener);

      const Scene = mocked.engine.getComponent(
        EditorComponentNames.Scene,
      ) as LastWriteWinElementSetComponentDefinition<EditorComponentsTypes['Scene']>;

      const addresses = ['0x0000000000000000000000000000000000000001'];
      const current = Scene.get(mocked.engine.RootEntity);
      Scene.createOrReplace(
        mocked.engine.RootEntity,
        serializationRoundTrip(Scene, {
          ...current,
          multiplayerServer: true,
          logsPermissions: addresses,
        }),
      );
      await mocked.engine.update(1);
      await new Promise(resolve => setTimeout(resolve, 50));

      expect((await readSceneJson(mocked.fs)).logsPermissions).toEqual(addresses);

      const updated = Scene.get(mocked.engine.RootEntity);
      Scene.createOrReplace(
        mocked.engine.RootEntity,
        serializationRoundTrip(Scene, { ...updated, multiplayerServer: false }),
      );
      await mocked.engine.update(1);
      await new Promise(resolve => setTimeout(resolve, 50));

      const sceneJsonAfter = await readSceneJson(mocked.fs);
      expect(sceneJsonAfter.authoritativeMultiplayer).toBe(false);
      expect(sceneJsonAfter.logsPermissions).toEqual(addresses);
    });
  });

  describe('when the scene name keeps changing while the previous change is still being saved', () => {
    it('should persist the last name into scene.json', async () => {
      const mocked = await mockedRpcInit();
      // A slow file system keeps the state manager busy persisting the first keystroke while
      // the next ones land, like the real host writing scene.json + main.composite to disk.
      const fs = {
        ...mocked.fs,
        writeFile: async (path: string, content: Buffer) => {
          await new Promise(resolve => setTimeout(resolve, 20));
          return mocked.fs.writeFile(path, content);
        },
      };
      await initRpcMethods(fs, mocked.engine, mocked.addEngineListener);

      const Scene = mocked.engine.getComponent(
        EditorComponentNames.Scene,
      ) as LastWriteWinElementSetComponentDefinition<EditorComponentsTypes['Scene']>;

      const typed = ['My s', 'My sc', 'My scene', 'My scene template'];
      for (const name of typed) {
        const current = Scene.get(mocked.engine.RootEntity);
        Scene.createOrReplace(
          mocked.engine.RootEntity,
          serializationRoundTrip(Scene, { ...current, name }),
        );
        await mocked.engine.update(1);
        await new Promise(resolve => setTimeout(resolve, 5));
      }
      await new Promise(resolve => setTimeout(resolve, 300));

      const sceneJson = await readSceneJson(mocked.fs);
      expect(sceneJson.display.title).toBe('My scene template');
    });
  });

  describe('when scene.json cannot be written', () => {
    it('should reject save() rather than report success over stale content on disk', async () => {
      const mocked = await mockedRpcInit();
      const rpc = await initRpcMethods(mocked.fs, mocked.engine, mocked.addEngineListener);
      const locked = breakWritesTo(mocked.fs, 'scene.json', 'EBUSY: resource busy or locked');

      const Scene = mocked.engine.getComponent(
        EditorComponentNames.Scene,
      ) as LastWriteWinElementSetComponentDefinition<EditorComponentsTypes['Scene']>;

      const current = Scene.get(mocked.engine.RootEntity);
      Scene.createOrReplace(
        mocked.engine.RootEntity,
        serializationRoundTrip(Scene, { ...current, name: 'Renamed before publishing' }),
      );
      await mocked.engine.update(1);
      await new Promise(resolve => setTimeout(resolve, 50));

      // The autosave failed, so the title the creator typed is not on disk. save() has to
      // say so: a save() that resolves here lets a publish package the previous scene.json.
      expect((await readSceneJson(mocked.fs)).display.title).not.toBe('Renamed before publishing');
      await expect(rpc.save({}, {} as any)).rejects.toThrow(/EBUSY/);

      locked.stop();

      // The edit is still pending, so the retry inside save() writes it — no further engine
      // change needed to unstick it.
      await rpc.save({}, {} as any);
      expect((await readSceneJson(mocked.fs)).display.title).toBe('Renamed before publishing');
    });
  });
  describe('when scene.json is rewritten from outside while the editor is open', () => {
    async function writeSceneJson(
      fs: Awaited<ReturnType<typeof feededFileSystem>>['fs'],
      scene: Record<string, unknown>,
    ) {
      await fs.writeFile('scene.json', Buffer.from(JSON.stringify(scene), 'utf-8'));
    }

    async function openEditorAndPublishFromOutside() {
      const mocked = await mockedRpcInit();
      const rpc = await initRpcMethods(mocked.fs, mocked.engine, mocked.addEngineListener);
      const Scene = mocked.engine.getComponent(
        EditorComponentNames.Scene,
      ) as LastWriteWinElementSetComponentDefinition<EditorComponentsTypes['Scene']>;
      // What the publish dialog writes: the parcels picked on the map plus the target world.
      const onDisk = await readSceneJson(mocked.fs);
      await writeSceneJson(mocked.fs, {
        ...onDisk,
        scene: { base: '50,60', parcels: ['50,60', '50,61', '51,60', '51,61'] },
        worldConfiguration: { name: 'my-world.dcl.eth' },
      });
      return { mocked, rpc, Scene };
    }

    it('should keep the new parcels and world when the editor saves before publishing', async () => {
      const { mocked, rpc } = await openEditorAndPublishFromOutside();

      await rpc.save({}, {} as any);

      const sceneJson = await readSceneJson(mocked.fs);
      expect(sceneJson.scene).toEqual({
        base: '50,60',
        parcels: ['50,60', '50,61', '51,60', '51,61'],
      });
      expect(sceneJson.worldConfiguration).toEqual({ name: 'my-world.dcl.eth' });
    });

    it('should keep them through a later autosave while still persisting the editor edit', async () => {
      const { mocked, rpc, Scene } = await openEditorAndPublishFromOutside();

      const current = Scene.get(mocked.engine.RootEntity);
      Scene.createOrReplace(
        mocked.engine.RootEntity,
        serializationRoundTrip(Scene, { ...current, name: 'Edited right before publishing' }),
      );
      await mocked.engine.update(1);
      await new Promise(resolve => setTimeout(resolve, 50));
      await rpc.save({}, {} as any);

      const sceneJson = await readSceneJson(mocked.fs);
      expect(sceneJson.display.title).toBe('Edited right before publishing');
      expect(sceneJson.display.description).toBe('This is a feeded scene.json into memory');
      expect(sceneJson.scene.base).toBe('50,60');
      expect(sceneJson.worldConfiguration).toEqual({ name: 'my-world.dcl.eth' });
    });

    it('should write a layout the editor itself changed, keeping the world', async () => {
      const { mocked, rpc, Scene } = await openEditorAndPublishFromOutside();

      // The publish dialog pushes the picked layout into the open editor too.
      const current = Scene.get(mocked.engine.RootEntity);
      Scene.createOrReplace(
        mocked.engine.RootEntity,
        serializationRoundTrip(Scene, {
          ...current,
          layout: { base: { x: 70, y: 80 }, parcels: [{ x: 70, y: 80 }] },
        }),
      );
      await mocked.engine.update(1);
      await new Promise(resolve => setTimeout(resolve, 50));
      await rpc.save({}, {} as any);

      const sceneJson = await readSceneJson(mocked.fs);
      expect(sceneJson.scene).toEqual({ base: '70,80', parcels: ['70,80'] });
      expect(sceneJson.worldConfiguration).toEqual({ name: 'my-world.dcl.eth' });
    });

    it('should drop a world that was removed from outside rather than restore it', async () => {
      const { mocked, rpc } = await openEditorAndPublishFromOutside();
      const { worldConfiguration: _removed, ...landPublish } = await readSceneJson(mocked.fs);
      await writeSceneJson(mocked.fs, landPublish);

      await rpc.save({}, {} as any);

      expect((await readSceneJson(mocked.fs)).worldConfiguration).toBeUndefined();
    });
  });

  describe('when scene.json cannot be parsed while the editor saves', () => {
    const editTitle = async (mocked: Awaited<ReturnType<typeof mockedRpcInit>>, name: string) => {
      const Scene = mocked.engine.getComponent(
        EditorComponentNames.Scene,
      ) as LastWriteWinElementSetComponentDefinition<EditorComponentsTypes['Scene']>;
      const current = Scene.get(mocked.engine.RootEntity);
      Scene.createOrReplace(
        mocked.engine.RootEntity,
        serializationRoundTrip(Scene, { ...current, name }),
      );
      await mocked.engine.update(1);
      await new Promise(resolve => setTimeout(resolve, 50));
    };

    describe('and it stays unreadable', () => {
      it('should fail the save and leave the file as it is, instead of writing the copy loaded at open', async () => {
        const mocked = await mockedRpcInit();
        const rpc = await initRpcMethods(mocked.fs, mocked.engine, mocked.addEngineListener);
        const truncated = Buffer.from('{"display": {"title": "Half writ', 'utf-8');
        await mocked.fs.writeFile('scene.json', truncated);

        await editTitle(mocked, 'Edited');

        await expect(rpc.save({}, {} as any)).rejects.toThrow(/Could not read scene.json/);
        expect(new TextDecoder().decode(await mocked.fs.readFile('scene.json'))).toBe(
          truncated.toString('utf-8'),
        );
      });
    });

    describe('and it is caught mid-write by another writer once', () => {
      it('should read it again and keep what that writer put there', async () => {
        const mocked = await mockedRpcInit();
        const rpc = await initRpcMethods(mocked.fs, mocked.engine, mocked.addEngineListener);
        const onDisk = await readSceneJson(mocked.fs);
        await mocked.fs.writeFile(
          'scene.json',
          Buffer.from(JSON.stringify({ ...onDisk, worldConfiguration: { name: 'w.dcl.eth' } })),
        );
        const readFile = mocked.fs.readFile;
        let reads = 0;
        mocked.fs.readFile = async (path: string) => {
          if (path === 'scene.json' && reads++ === 0) return Buffer.from('{"display": {', 'utf-8');
          return readFile(path);
        };

        await editTitle(mocked, 'Edited');
        await rpc.save({}, {} as any);
        mocked.fs.readFile = readFile;

        const sceneJson = await readSceneJson(mocked.fs);
        expect(sceneJson.display.title).toBe('Edited');
        expect(sceneJson.worldConfiguration).toEqual({ name: 'w.dcl.eth' });
      });
    });
  });
});
