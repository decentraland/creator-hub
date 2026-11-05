import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryTransport, RPC } from '@dcl/mini-rpc';

import type { Project } from '/shared/types/projects';

import { store } from '/@/modules/store';
import { actions as workspaceActions } from '/@/modules/store/workspace';

import { SceneRpcServer } from './server';

/** The real store module boots the app on import. */
vi.mock('/@/modules/store', async () => {
  const { createTestStore } = await import('../../../../tests/utils/testStore');
  return { store: createTestStore() };
});

const PROJECT = {
  id: 'project-id',
  path: '/scenes/my-scene',
  title: 'My scene',
  scene: { base: '0,0', parcels: ['0,0'] },
} as Project;

describe('SceneRpcServer notify_scene_metadata', () => {
  let inspector: RPC<string, any, any>;

  const notify = (title: string, base: string) =>
    inspector.request('notify_scene_metadata', { title, scene: { base, parcels: [base] } });
  const storedProject = () => store.getState().editor.project;

  beforeEach(async () => {
    const host = new InMemoryTransport();
    const iframe = new InMemoryTransport();
    host.connect(iframe);
    iframe.connect(host);
    store.dispatch(
      workspaceActions.createProject.fulfilled(PROJECT, 'request-id', undefined as never),
    );
    new SceneRpcServer(host, PROJECT);
    inspector = new RPC('SceneRpcOutbound', iframe);
    await notify('My scene', '0,0');
  });

  afterEach(() => {
    store.dispatch(workspaceActions.updateProject({ ...PROJECT }));
  });

  describe('when the publish dialog moved the scene and the editor then reports a new title', () => {
    beforeEach(async () => {
      store.dispatch(
        workspaceActions.updateProject({
          ...PROJECT,
          scene: { base: '50,60', parcels: ['50,60'] },
        }),
      );
      await notify('Renamed', '0,0');
    });

    it('should take the title', () => {
      expect(storedProject()?.title).toBe('Renamed');
    });

    it('should keep the parcels picked for publishing', () => {
      expect(storedProject()?.scene).toEqual({ base: '50,60', parcels: ['50,60'] });
    });
  });

  describe('when the editor reports a layout that changed', () => {
    it('should take it', async () => {
      await notify('My scene', '70,80');

      expect(storedProject()?.scene).toEqual({ base: '70,80', parcels: ['70,80'] });
    });
  });
});
