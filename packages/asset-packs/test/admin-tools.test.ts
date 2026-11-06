import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Entity } from '@dcl/ecs';
import type { AdminTools as AdminToolsClass } from '../packs/smart_items/assets/admin_toolkit/AdminTools';
import type * as Config from '../src/admin-toolkit-ui/config';
import { fakeSdkEcs, loadScriptEngine, type ScriptEngine } from './script-harness';

const mocks = vi.hoisted(() => ({
  isServer: vi.fn(),
  createAdminToolkitUI: vi.fn(),
  removeUiRenderer: vi.fn(),
}));

vi.mock('@dcl/sdk/ecs', () => fakeSdkEcs());
vi.mock('@dcl/sdk/react-ecs', () => ({
  ReactEcsRenderer: { removeUiRenderer: mocks.removeUiRenderer },
}));
vi.mock('@dcl/sdk/network', () => ({ syncEntity: vi.fn() }));
vi.mock('@dcl/sdk/players', () => ({ default: {} }));
vi.mock('~system/EngineApi', () => ({ isServer: mocks.isServer }));
vi.mock('@dcl/asset-packs/dist/admin-toolkit-ui', async () => ({
  ...(await import('../src/admin-toolkit-ui/config')),
  createAdminToolkitUI: mocks.createAdminToolkitUI,
}));
vi.mock('../packs/smart_items/assets/admin_toolkit/AdminPanel', () => ({
  renderAdminPanel: vi.fn(),
}));

describe('AdminTools', () => {
  let ecs: ScriptEngine;
  let admin: AdminToolsClass;
  let uiRoot: Entity;
  let getAdminConfigOrNull: typeof Config.getAdminConfigOrNull;

  const flushRoleCheck = () => new Promise(resolve => setTimeout(resolve, 0));

  beforeEach(async () => {
    vi.clearAllMocks();
    ecs = await loadScriptEngine();
    ({ getAdminConfigOrNull } = await import('../src/admin-toolkit-ui/config'));
    uiRoot = ecs.engine.addEntity();
    mocks.createAdminToolkitUI.mockReturnValue(uiRoot);
    mocks.isServer.mockResolvedValue({ isServer: false });
    const { AdminTools } = await import('../packs/smart_items/assets/admin_toolkit/AdminTools');
    admin = new AdminTools('src', ecs.engine.addEntity());
  });

  describe('when it starts on a client', () => {
    beforeEach(async () => {
      admin.start();
      await flushRoleCheck();
    });

    it('should mount the admin panel', () => {
      expect(mocks.createAdminToolkitUI).toHaveBeenCalledTimes(1);
    });

    it('should inject its config', () => {
      expect(getAdminConfigOrNull(ecs.engine)?.adminPermissions).toBe('PUBLIC');
    });

    describe('and its entity is removed', () => {
      beforeEach(async () => {
        ecs.engine.removeEntity(admin.entity);
        await ecs.engine.update(1);
      });

      it('should unmount the panel', () => {
        expect(mocks.removeUiRenderer).toHaveBeenCalledWith(uiRoot);
        expect(ecs.engine.getEntityState(uiRoot)).toBe(ecs.EntityState.Removed);
      });

      it('should drop the injected config', () => {
        expect(getAdminConfigOrNull(ecs.engine)).toBeNull();
      });
    });
  });

  describe('when its entity is removed before the role check resolves', () => {
    beforeEach(async () => {
      admin.start();
      ecs.engine.removeEntity(admin.entity);
      await flushRoleCheck();
    });

    it('should not mount the admin panel', () => {
      expect(mocks.createAdminToolkitUI).not.toHaveBeenCalled();
    });
  });

  describe('when it starts on the server', () => {
    beforeEach(async () => {
      mocks.isServer.mockResolvedValue({ isServer: true });
      admin.start();
      await flushRoleCheck();
    });

    it('should not mount the admin panel', () => {
      expect(mocks.createAdminToolkitUI).not.toHaveBeenCalled();
    });
  });
});
