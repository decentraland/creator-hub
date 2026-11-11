import { describe, it, expect, vi } from 'vitest';
import { Engine } from '@dcl/ecs';
import { ComponentName, createComponents } from '@dcl/asset-packs';

import type { FileSystemInterface } from '../../../types';
import { repairScriptParams } from './repair-script-params';

const SOURCE = `
  import type { Entity } from '@dcl/sdk/ecs';
  export class AdminTools {
    constructor(
      public src: string,
      public entity: Entity,
      public adminPermissions: 'PUBLIC' | 'PRIVATE' = 'PUBLIC',
      public authorizedAdminUsers: { me: boolean; sceneOwners: boolean } = {
        me: true,
        sceneOwners: true,
      },
    ) {}
  }
`;
const PATH = 'assets/asset-packs/admin_tools/AdminTools.ts';

const layout = (authorizedAdminUsers: unknown) =>
  JSON.stringify({
    params: {
      adminPermissions: { type: 'enum', value: 'PRIVATE', options: ['PUBLIC', 'PRIVATE'] },
      authorizedAdminUsers: {
        type: 'object',
        value: authorizedAdminUsers,
        fields: {
          me: { type: 'boolean', value: false },
          sceneOwners: { type: 'boolean', value: false },
        },
      },
    },
  });

function setup(storedLayout: string, files: Record<string, string> = { [PATH]: SOURCE }) {
  const engine = Engine();
  createComponents(engine);
  const Script = engine.getComponent(ComponentName.SCRIPT) as any;
  const entity = engine.addEntity();
  Script.create(entity, { value: [{ path: PATH, priority: 0, layout: storedLayout }] });
  const fs = {
    existFile: vi.fn(async (path: string) => path in files),
    readFile: vi.fn(async (path: string) => Buffer.from(files[path], 'utf-8')),
  } as unknown as FileSystemInterface;
  const read = () => JSON.parse(Script.get(entity).value[0].layout).params;
  return { engine, fs, read };
}

describe('repairScriptParams', () => {
  it('rebuilds an object param saved as text and keeps the other params', async () => {
    const { engine, fs, read } = setup(layout('[object Object]'));
    expect(await repairScriptParams(engine, fs)).toBe(true);
    expect(read().authorizedAdminUsers.value).toEqual({ me: true, sceneOwners: true });
    expect(read().adminPermissions.value).toBe('PRIVATE');
  });

  it('leaves healthy layouts alone without reading the script', async () => {
    const { engine, fs } = setup(layout({ me: false, sceneOwners: true }));
    expect(await repairScriptParams(engine, fs)).toBe(false);
    expect(fs.readFile).not.toHaveBeenCalled();
  });

  it('leaves a broken layout alone when the script file is missing', async () => {
    const { engine, fs, read } = setup(layout('[object Object]'), {});
    expect(await repairScriptParams(engine, fs)).toBe(false);
    expect(read().authorizedAdminUsers.value).toBe('[object Object]');
  });
});
