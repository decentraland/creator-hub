import type { Transport } from '@dcl/mini-rpc';
import { RPC } from '@dcl/mini-rpc';
import { name, type Method, type Params, type Result } from './types';

export class SceneClient extends RPC<Method, Params, Result> {
  constructor(transport: Transport) {
    super(name, transport);
  }

  takeScreenshot = (width: number, height: number, precision?: number) => {
    return this.request('take_screenshot', { width, height, precision });
  };

  setTarget = (x: number, y: number, z: number) => {
    return this.request('set_target', { x, y, z });
  };

  setPosition = (x: number, y: number, z: number) => {
    return this.request('set_position', { x, y, z });
  };
}
