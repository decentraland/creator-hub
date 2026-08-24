import type { OnChangeFunction } from '@dcl/ecs';
import * as ecsComponents from '@dcl/ecs/dist/components';
import { feededFileSystem } from '../client/feeded-local-fs';
import { initRpcMethods } from './rpc-methods';
import { getCurrentCompositePath } from './fs-utils';
import { createEngineContext } from './utils/engine';

async function mockedRpcInit() {
  const callbackFunctions: OnChangeFunction[] = [];
  const fs = await feededFileSystem();
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

async function readComposite(fs: Awaited<ReturnType<typeof feededFileSystem>>) {
  const buffer = await fs.readFile(getCurrentCompositePath());
  return JSON.parse(new TextDecoder().decode(buffer));
}

function positionOf(composite: any, entity: number) {
  const transforms = composite.components.find((c: any) => c.name === 'core::Transform');
  return transforms?.data?.[String(entity)]?.json?.position;
}

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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
});
