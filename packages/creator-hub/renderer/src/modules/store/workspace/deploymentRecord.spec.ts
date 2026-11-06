import { configureStore } from '@reduxjs/toolkit';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthIdentity } from '@dcl/crypto';

import type { Project, ProjectInfo } from '/shared/types/projects';

import { workspace } from '#preload';
import type { Info } from '/@/lib/deploy';
import { actions as deploymentActions, deploy, type Deployment } from '/@/modules/store/deployment';

import { deploymentRecordMiddleware } from './deploymentRecord';
import { actions, reducer } from './index';

const NOW = 1_700_000_000_000;

const createStore = () =>
  configureStore({
    reducer: { workspace: reducer },
    middleware: getDefaultMiddleware =>
      getDefaultMiddleware({ serializableCheck: false }).concat(deploymentRecordMiddleware),
  });

const localProject = (path: string, overrides: Partial<Project> = {}) =>
  ({
    path,
    title: path,
    info: { id: path, skipPublishWarning: false },
    ...overrides,
  }) as Project;

const deployArg = (path: string) => ({
  identity: {} as AuthIdentity,
  deployment: { path } as Deployment,
});

const deployInfo = (overrides: Partial<Info> = {}) =>
  ({
    baseParcel: '5,7',
    parcels: ['5,7'],
    isWorld: false,
    rootCID: 'bafy-new',
    ...overrides,
  }) as Info;

function setup(projects: Project[]) {
  const store = createStore();
  const { settings, sortBy } = store.getState().workspace;
  store.dispatch(actions.getWorkspace.fulfilled({ settings, sortBy, projects, missing: [] }, ''));
  const publish = (path: string, info: Info) =>
    store.dispatch(deploy.fulfilled({ info }, 'request', deployArg(path)));
  const infoOf = (path: string): ProjectInfo =>
    store.getState().workspace.projects.find(project => project.path === path)!.info;
  return { store, publish, infoOf };
}

const settle = () => new Promise(resolve => setTimeout(resolve, 0));

describe('deploymentRecordMiddleware', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    vi.mocked(workspace.updateProjectInfo).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  describe('when a scene is published on LAND', () => {
    it('should record the deployed entity under its base parcel in the project info', async () => {
      const { publish, infoOf } = setup([localProject('/scenes/a')]);

      publish('/scenes/a', deployInfo());
      await settle();

      const deployments = {
        'land:5,7': { publishedAt: NOW, deploymentHash: 'bafy-new', parcel: '5,7' },
      };
      expect(workspace.updateProjectInfo).toHaveBeenCalledWith(
        { path: '/scenes/a', info: { deployments } },
        expect.anything(),
      );
      expect(infoOf('/scenes/a').deployments).toEqual(deployments);
    });
  });

  describe('when a scene is published in a World', () => {
    it('should record it under the World name and base parcel, with the World name', async () => {
      const { publish, infoOf } = setup([
        localProject('/scenes/w', {
          worldConfiguration: { name: 'example-world.dcl.eth' },
        } as Partial<Project>),
      ]);

      publish('/scenes/w', deployInfo({ isWorld: true, baseParcel: '0,0', rootCID: 'bafy-w' }));
      await settle();

      expect(infoOf('/scenes/w').deployments).toEqual({
        'world:example-world.dcl.eth:0,0': {
          publishedAt: NOW,
          deploymentHash: 'bafy-w',
          parcel: '0,0',
          worldName: 'example-world.dcl.eth',
        },
      });
    });
  });

  describe('when the scene was already published to the same target and to another', () => {
    it('should overwrite that target and keep the other', async () => {
      const other = {
        publishedAt: 1,
        deploymentHash: 'bafy-world',
        parcel: '0,0',
        worldName: 'w.dcl.eth',
      };
      const { publish } = setup([
        localProject('/scenes/a', {
          info: {
            id: 'a',
            skipPublishWarning: false,
            deployments: {
              'land:5,7': { publishedAt: 1, deploymentHash: 'bafy-old', parcel: '5,7' },
              'world:w.dcl.eth:0,0': other,
            },
          },
        }),
      ]);

      publish('/scenes/a', deployInfo());
      await settle();

      expect(workspace.updateProjectInfo).toHaveBeenCalledWith(
        {
          path: '/scenes/a',
          info: {
            deployments: {
              'land:5,7': { publishedAt: NOW, deploymentHash: 'bafy-new', parcel: '5,7' },
              'world:w.dcl.eth:0,0': other,
            },
          },
        },
        expect.anything(),
      );
    });
  });

  describe('when the content server rejects the deployment', () => {
    it('should record nothing', async () => {
      const { store } = setup([localProject('/scenes/a')]);

      store.dispatch(deploy.rejected(new Error('down'), 'request', deployArg('/scenes/a')));
      await settle();

      expect(workspace.updateProjectInfo).not.toHaveBeenCalled();
    });
  });

  describe('when the whole publish ends, after the status polling', () => {
    it('should not record it a second time', async () => {
      const { store } = setup([localProject('/scenes/a')]);

      store.dispatch(
        deploymentActions.executeDeployment.fulfilled(
          {
            info: deployInfo(),
            componentsStatus: { catalyst: 'complete', assetBundle: 'complete', lods: 'complete' },
          },
          'request',
          '/scenes/a',
        ),
      );
      await settle();

      expect(workspace.updateProjectInfo).not.toHaveBeenCalled();
    });
  });
});
