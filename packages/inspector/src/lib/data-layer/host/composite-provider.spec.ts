import type { OnChangeFunction } from '@dcl/ecs';
import * as ecsComponents from '@dcl/ecs/dist/components';
import { feededFileSystem } from '../client/feeded-local-fs';
import { initRpcMethods } from './rpc-methods';
import { getCurrentCompositePath } from './fs-utils';
import { createEngineContext } from './utils/engine';

async function mockedRpcInit() {
  const callbackFunctions: OnChangeFunction[] = [];
  const { fs } = await feededFileSystem();
  const engineContext = createEngineContext({
    onChangeFunction: (entity, operation, component, componentValue) => {
      callbackFunctions.forEach(func => func(entity, operation, component, componentValue));
    },
  });

  return {
    fs,
    engine: engineContext.engine,
    addEngineListener: (fn: OnChangeFunction) => {
      callbackFunctions.push(fn);
    },
  };
}

async function readComposite(fs: Awaited<ReturnType<typeof feededFileSystem>>['fs']) {
  const buffer = await fs.readFile(getCurrentCompositePath());
  return JSON.parse(new TextDecoder().decode(buffer));
}

function positionOf(composite: any, entity: number) {
  const transforms = composite.components.find((c: any) => c.name === 'core::Transform');
  return transforms?.data?.[String(entity)]?.json?.position;
}

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** Holds composite writes until `release()`, so a test can land an edit mid-write. */
function holdCompositeWrites(fs: Awaited<ReturnType<typeof feededFileSystem>>['fs']) {
  const original = fs.writeFile;
  let held = true;
  let started = false;
  let release = () => {};
  const gate = new Promise<void>(resolve => {
    release = resolve;
  });

  fs.writeFile = async (path: string, content: Buffer) => {
    if (held && path === getCurrentCompositePath()) {
      started = true;
      await gate;
    }
    return original(path, content);
  };

  return {
    hasStarted: () => started,
    release() {
      held = false;
      release();
    },
  };
}

/** Makes composite writes fail until `stop()` is called. */
function breakCompositeWrites(fs: Awaited<ReturnType<typeof feededFileSystem>>['fs']) {
  const original = fs.writeFile;
  fs.writeFile = async (path: string, content: Buffer) => {
    if (path === getCurrentCompositePath()) throw new Error('EBUSY: resource busy or locked');
    return original(path, content);
  };
  return {
    stop() {
      fs.writeFile = original;
    },
  };
}

describe('CompositeProvider', () => {
  const originalError = console.error;
  beforeEach(() => {
    console.error = () => {};
  });
  afterAll(() => {
    console.error = originalError;
  });

  describe('when two edits land inside the autosave throttle window', () => {
    // The second edit is throttled out of its own save, and nothing else is queued behind
    // it. Only the trailing save gets it to disk; without one it stays in memory and a
    // publish right after packages a composite without it.
    it('should still persist the last edit of the burst', async () => {
      const mocked = await mockedRpcInit();
      await initRpcMethods(mocked.fs, mocked.engine, mocked.addEngineListener);

      const Transform = ecsComponents.Transform(mocked.engine);
      const entity = mocked.engine.addEntity();

      Transform.createOrReplace(entity, { position: { x: 1, y: 0, z: 0 } });
      await mocked.engine.update(1);
      // Long enough for the state manager's setTimeout(0) batch to commit as its own
      // transaction, short enough to stay inside the 100 ms throttle window.
      await wait(5);

      Transform.createOrReplace(entity, { position: { x: 7, y: 0, z: 0 } });
      await mocked.engine.update(1);

      // Past the throttle window, so a trailing save has had its chance to run.
      await wait(300);

      expect(positionOf(await readComposite(mocked.fs), entity)).toMatchObject({ x: 7 });
    });
  });

  describe('when an edit lands while the trailing save is still writing', () => {
    // The trailing save does not hold the transaction queue, so the edit is processed while
    // the write is in flight. Marking the provider clean when that write finishes would
    // leave the edit in memory with nothing left to save it.
    it('should still persist that edit', async () => {
      const mocked = await mockedRpcInit();
      await initRpcMethods(mocked.fs, mocked.engine, mocked.addEngineListener);

      const Transform = ecsComponents.Transform(mocked.engine);
      const entity = mocked.engine.addEntity();

      Transform.createOrReplace(entity, { position: { x: 1, y: 0, z: 0 } });
      await mocked.engine.update(1);
      await wait(5);

      const hold = holdCompositeWrites(mocked.fs);
      Transform.createOrReplace(entity, { position: { x: 2, y: 0, z: 0 } });
      await mocked.engine.update(1);

      await vi.waitFor(() => expect(hold.hasStarted()).toBe(true), { timeout: 1000 });

      Transform.createOrReplace(entity, { position: { x: 3, y: 0, z: 0 } });
      await mocked.engine.update(1);
      await wait(5);

      hold.release();
      await wait(300);

      expect(positionOf(await readComposite(mocked.fs), entity)).toMatchObject({ x: 3 });
    });
  });

  describe('when the composite cannot be written', () => {
    it('should reject save() and write the pending edit once the disk recovers', async () => {
      const mocked = await mockedRpcInit();
      const rpc = await initRpcMethods(mocked.fs, mocked.engine, mocked.addEngineListener);

      const Transform = ecsComponents.Transform(mocked.engine);
      const entity = mocked.engine.addEntity();
      const broken = breakCompositeWrites(mocked.fs);

      Transform.createOrReplace(entity, { position: { x: 5, y: 0, z: 0 } });
      await mocked.engine.update(1);
      await wait(300);

      await expect(rpc.save({}, {} as any)).rejects.toThrow(/EBUSY/);

      broken.stop();
      await rpc.save({}, {} as any);

      expect(positionOf(await readComposite(mocked.fs), entity)).toMatchObject({ x: 5 });
    });
  });
});
