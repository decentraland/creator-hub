import type { Engine, FreeCamera } from '@babylonjs/core';
import { ScreenshotTools, Vector3 } from '@babylonjs/core';
import type { Transport } from '@dcl/mini-rpc';
import { RPC } from '@dcl/mini-rpc';
import { name, type Method, type Params, type Result } from './types';

export class SceneServer extends RPC<Method, Params, Result> {
  constructor(transport: Transport, engine: Engine, camera: FreeCamera) {
    super(name, transport);

    this.handle('set_position', async ({ x, y, z }) => {
      camera.position.set(x, y, z);
    });

    this.handle('set_target', async ({ x, y, z }) => {
      camera.setTarget(new Vector3(x, y, z));
    });

    this.handle('take_screenshot', async ({ width, height, precision }) => {
      return ScreenshotTools.CreateScreenshotAsync(engine, camera, { width, height, precision });
    });
  }
}
