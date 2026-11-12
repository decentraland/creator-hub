import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dark, ThemeProvider } from 'decentraland-ui2/dist/theme';

import { feedback, misc } from '#preload';

import type { Project } from '/shared/types/projects';
import {
  initializeDeployment,
  reducer as deploymentReducer,
  type Deployment,
} from '/@/modules/store/deployment/slice';
import type { Props } from '/@/components/Modals/PublishProject/types';
import { HELP_FAQ_URL } from '/@/modules/utils';

import { Deploy } from './component';

const hooks = vi.hoisted(() => ({
  deployment: undefined as Deployment | undefined,
  dispatch: vi.fn(),
  names: {} as Record<string, { nftOwnerAddress?: string }>,
  worldScenes: [] as { parcels: string[] }[],
  wallet: '0xabc' as string | undefined,
  fetchWorldSceneSizeLimit: vi.fn(async () => null),
}));

vi.mock('#store', () => ({
  useDispatch: () => hooks.dispatch,
  useSelector: (selector: (state: unknown) => unknown) =>
    selector({
      ens: { data: hooks.names },
      management: { worldSettings: { scenes: hooks.worldScenes } },
    }),
}));
vi.mock('/@/hooks/useAuth', () => ({
  useAuth: () => ({ signOut: vi.fn(), wallet: hooks.wallet }),
}));
vi.mock('/@/hooks/useWorkspace', () => ({
  useWorkspace: () => ({ updateProjectInfo: vi.fn() }),
}));
vi.mock('/@/hooks/useEditor', () => ({
  useEditor: () => ({ loadingPublish: false, publishError: null }),
}));
vi.mock('/@/hooks/useDeploy', () => ({
  useDeploy: () => ({ getDeployment: () => hooks.deployment, executeDeployment: vi.fn() }),
}));
vi.mock('/@/modules/store/deployment/utils', async importOriginal => ({
  ...((await importOriginal()) as object),
  fetchWorldSceneSizeLimit: hooks.fetchWorldSceneSizeLimit,
}));
vi.mock('/@/hooks/useSnackbar', () => ({ useSnackbar: () => ({ pushCustom: vi.fn() }) }));

vi.mock('/@/modules/store/translation/utils', async importOriginal => ({
  ...((await importOriginal()) as object),
  t: (id: string) => id,
}));

/** The modal shell and the scene header read breakpoints and store slices this environment
 * does not populate; the behavior under test lives in the step body. */
vi.mock('/@/components/Modals/PublishProject/PublishModal', () => ({
  PublishModal: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('/@/components/Modals/PublishProject/ProjectStepWrapper', () => ({
  ProjectStepWrapper: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

const PROJECT = {
  path: '/scenes/example',
  info: {},
  scene: { parcels: ['0,0'], base: '0,0' },
} as unknown as Project;

const createDeployment = (overrides: Partial<Deployment> = {}): Deployment => ({
  id: 'deployment-1',
  path: PROJECT.path,
  url: 'http://localhost:4000/api',
  info: {
    isWorld: false,
    rootCID: 'bafy',
    title: 'Example',
    parcels: ['0,0'],
  } as Deployment['info'],
  files: [],
  wallet: '0xabc',
  chainId: 1,
  status: 'pending',
  componentsStatus: { catalyst: 'pending', assetBundle: 'idle' },
  supportsDeployResource: true,
  hasCancelToken: true,
  phase: 'uploading',
  upload: null,
  createdAt: 0,
  lastUpdated: 0,
  ...overrides,
});

describe('Deploy step', () => {
  let props: Props;
  let rerender: () => void;

  beforeEach(() => {
    props = {
      open: true,
      project: PROJECT,
      previousStep: 'publish-to-land',
      onBack: vi.fn(),
      onClose: vi.fn(),
      onStep: vi.fn(),
    };
  });

  afterEach(() => {
    cleanup();
    hooks.deployment = undefined;
    hooks.names = {};
    hooks.worldScenes = [];
    hooks.wallet = '0xabc';
    hooks.fetchWorldSceneSizeLimit.mockClear();
  });

  const mount = () => {
    const ui = () => (
      <MemoryRouter>
        <ThemeProvider theme={dark}>
          <Deploy {...props} />
        </ThemeProvider>
      </MemoryRouter>
    );
    const result = render(ui());
    rerender = () => result.rerender(ui());
  };

  describe('when a pending deployment gets cancelled', () => {
    beforeEach(() => {
      hooks.deployment = createDeployment();
      mount();
      hooks.deployment = createDeployment({ status: 'cancelled', phase: 'cancelled' });
      rerender();
    });

    it('should go back to the previous step', () => {
      expect(props.onBack).toHaveBeenCalledTimes(1);
    });

    it('should not close the modal', () => {
      expect(props.onClose).not.toHaveBeenCalled();
    });
  });

  describe('when a pending deployment gets cancelled and there is no previous step', () => {
    beforeEach(() => {
      props.previousStep = undefined;
      hooks.deployment = createDeployment();
      mount();
      hooks.deployment = createDeployment({ status: 'cancelled', phase: 'cancelled' });
      rerender();
    });

    it('should close the modal', () => {
      expect(props.onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('when the step mounts over a deployment cancelled earlier', () => {
    beforeEach(() => {
      hooks.deployment = createDeployment({ status: 'cancelled', phase: 'cancelled' });
      mount();
    });

    it('should neither go back nor close the modal', () => {
      expect(props.onBack).not.toHaveBeenCalled();
      expect(props.onClose).not.toHaveBeenCalled();
    });
  });

  describe('when the CLI reports a cancellation under way', () => {
    beforeEach(() => {
      hooks.deployment = createDeployment({ cancelRequested: true });
      mount();
    });

    it('should show the cancellation in progress', () => {
      const button = screen.getByRole('button', {
        name: 'modal.publish_project.deploy.deploying.actions.cancelling',
      }) as HTMLButtonElement;
      expect(button.disabled).toBe(true);
    });
  });

  describe('when the CLI follows the deployment but takes no deploy token', () => {
    beforeEach(() => {
      hooks.deployment = createDeployment({ hasCancelToken: false });
      mount();
    });

    it('should not allow cancelling', () => {
      const button = screen.getByRole('button', {
        name: 'modal.publish_project.deploy.deploying.actions.cancel',
      }) as HTMLButtonElement;
      expect(button.disabled).toBe(true);
    });

    it('should explain how to enable cancelling', () => {
      expect(screen.getByRole('status').textContent).toBe(
        'modal.publish_project.deploy.deploying.progress.cancel_unsupported',
      );
    });
  });

  describe.each([
    ['too-early', 'modal.publish_project.deploy.deploying.progress.cancel_too_early'],
    ['unauthorized', 'modal.publish_project.deploy.deploying.progress.cancel_unauthorized'],
  ])('when the CLI turns the cancellation down as %s', (rejection, message) => {
    beforeEach(async () => {
      hooks.dispatch.mockReturnValue({
        unwrap: () => Promise.resolve({ deploymentId: 'deployment-1', rejection }),
      });
      hooks.deployment = createDeployment();
      mount();
      await act(async () => {
        fireEvent.click(
          screen.getByRole('button', {
            name: 'modal.publish_project.deploy.deploying.actions.cancel',
          }),
        );
      });
    });

    it('should explain why', () => {
      expect(screen.getByRole('status').textContent).toBe(message);
    });

    it('should offer to cancel again', () => {
      const button = screen.getByRole('button', {
        name: 'modal.publish_project.deploy.deploying.actions.cancel',
      }) as HTMLButtonElement;
      expect(button.disabled).toBe(false);
    });
  });

  describe('when the CLI takes the cancellation', () => {
    beforeEach(async () => {
      hooks.dispatch.mockReturnValue({
        unwrap: () => Promise.resolve({ deploymentId: 'deployment-1', rejection: null }),
      });
      hooks.deployment = createDeployment();
      mount();
      await act(async () => {
        fireEvent.click(
          screen.getByRole('button', {
            name: 'modal.publish_project.deploy.deploying.actions.cancel',
          }),
        );
      });
    });

    it('should show the cancellation in progress until the deployment ends', () => {
      const button = screen.getByRole('button', {
        name: 'modal.publish_project.deploy.deploying.actions.cancelling',
      }) as HTMLButtonElement;
      expect(button.disabled).toBe(true);
    });

    describe('and a new deployment starts', () => {
      beforeEach(() => {
        hooks.deployment = createDeployment({ id: 'deployment-2' });
        rerender();
      });

      it('should offer to cancel the new one', () => {
        const button = screen.getByRole('button', {
          name: 'modal.publish_project.deploy.deploying.actions.cancel',
        }) as HTMLButtonElement;
        expect(button.disabled).toBe(false);
      });
    });
  });

  describe('when a World deployment completes', () => {
    beforeEach(() => {
      props.project = {
        ...PROJECT,
        worldConfiguration: { name: 'plaza.dcl.eth' },
      } as unknown as Project;
      hooks.deployment = createDeployment({
        status: 'complete',
        info: {
          isWorld: true,
          rootCID: 'bafy',
          title: 'Example',
          parcels: ['0,0'],
        } as Deployment['info'],
      });
    });

    describe('and the wallet owns the World', () => {
      beforeEach(() => {
        hooks.names = { 'plaza.dcl.eth': { nftOwnerAddress: '0xABC' } };
        mount();
      });

      it('should link to the World Settings', () => {
        expect(
          screen.getByRole('link', { name: 'modal.publish_project.deploy.success.world_settings' }),
        ).toBeTruthy();
      });
    });

    describe('and the wallet only collaborates on the World', () => {
      beforeEach(() => {
        hooks.names = { 'plaza.dcl.eth': {} };
        mount();
      });

      it('should offer no World Settings link', () => {
        expect(
          screen.queryByRole('link', {
            name: 'modal.publish_project.deploy.success.world_settings',
          }),
        ).toBeNull();
      });
    });
  });

  describe('when a LAND deployment completes on a parcel other than the opened project base', () => {
    beforeEach(() => {
      hooks.deployment = createDeployment({
        status: 'complete',
        phase: undefined,
        componentsStatus: { catalyst: 'complete', assetBundle: 'complete' },
        info: {
          isWorld: false,
          rootCID: 'bafy',
          title: 'Example',
          baseParcel: '20,2',
          parcels: ['20,2'],
        } as Deployment['info'],
      });
      mount();
    });

    it('should share the deployed parcel', () => {
      expect(screen.getByText(/jump\?position=20,2$/)).toBeTruthy();
    });

    describe('and the user jumps in', () => {
      beforeEach(() => {
        fireEvent.click(
          screen.getByRole('button', { name: 'modal.publish_project.deploy.success.jump_in' }),
        );
      });

      it('should open the deployed parcel in the desktop client', () => {
        expect(misc.openExternal).toHaveBeenCalledWith(
          expect.stringMatching(/^decentraland:\/\/\?position=20,2&/),
        );
      });
    });
  });

  describe('when publishing to a single-scene world whose other scenes get removed first', () => {
    beforeEach(() => {
      hooks.worldScenes = [{ parcels: ['5,5'] }];
      hooks.deployment = createDeployment({
        status: 'idle',
        phase: undefined,
        info: { isWorld: true, rootCID: 'bafy', parcels: ['0,0'] } as Deployment['info'],
      });
      props = {
        ...props,
        previousStep: 'publish-to-world',
        project: { ...PROJECT, worldConfiguration: { name: 'name.dcl.eth' } } as typeof PROJECT,
        deploymentMetadata: { isMultiScene: false } as Props['deploymentMetadata'],
      };
      mount();
    });

    it('should ask for the limit of the whole world, as all of it is credited back', () => {
      expect(hooks.fetchWorldSceneSizeLimit).toHaveBeenCalledWith('name.dcl.eth', ['0,0'], {
        replacesWorld: true,
      });
    });
  });

  describe('when publishing to a single-scene world with other scenes but no wallet to remove them', () => {
    beforeEach(() => {
      hooks.wallet = undefined;
      hooks.worldScenes = [{ parcels: ['5,5'] }];
      hooks.deployment = createDeployment({
        status: 'idle',
        phase: undefined,
        info: { isWorld: true, rootCID: 'bafy', parcels: ['0,0'] } as Deployment['info'],
      });
      props = {
        ...props,
        previousStep: 'publish-to-world',
        project: { ...PROJECT, worldConfiguration: { name: 'name.dcl.eth' } } as typeof PROJECT,
        deploymentMetadata: { isMultiScene: false } as Props['deploymentMetadata'],
      };
      mount();
    });

    it('should ask for the limit of the scene alone, as the world will not be emptied', () => {
      expect(hooks.fetchWorldSceneSizeLimit).toHaveBeenCalledWith('name.dcl.eth', ['0,0'], {
        replacesWorld: false,
      });
    });
  });
  describe('when the deployment failed', () => {
    beforeEach(() => {
      hooks.deployment = createDeployment({
        status: 'failed',
        error: { name: 'DEPLOYMENT_FAILED', message: 'Failed', eventId: 'deploy-event-id' },
      });
      mount();
    });

    it('should link to the Help Center', () => {
      fireEvent.click(screen.getByRole('link', { name: 'modal.report_issue.help_center' }));
      expect(misc.openExternal).toHaveBeenCalledWith(HELP_FAQ_URL);
    });

    describe('and the user reports it', () => {
      beforeEach(async () => {
        vi.mocked(feedback.send).mockResolvedValue('sent');
        fireEvent.click(
          screen.getByRole('button', {
            name: 'modal.publish_project.deploy.deploying.actions.report_issue',
          }),
        );
        fireEvent.change(
          screen.getByRole('textbox', { name: 'modal.report_issue.description.label' }),
          { target: { value: 'Publishing failed' } },
        );
        await act(async () =>
          fireEvent.click(screen.getByRole('button', { name: 'modal.report_issue.send' })),
        );
      });

      it('should send the report linked to the failure', () => {
        expect(feedback.send).toHaveBeenCalledWith({
          message: 'Publishing failed',
          includeLogs: true,
          associatedEventId: 'deploy-event-id',
          source: 'publish-failure',
        });
      });

      it('should not open the Typeform', () => {
        expect(misc.openExternal).not.toHaveBeenCalled();
      });
    });
  });

  describe('when the publish server cannot be read, as when the connection drops on Review', () => {
    beforeEach(() => {
      const arg = {
        path: PROJECT.path,
        port: 4000,
        supportsDeployResource: true,
        hasCancelToken: true,
        chainId: 1,
        wallet: '0xabc',
      };
      const state = deploymentReducer(
        undefined,
        initializeDeployment.rejected(new TypeError('Failed to fetch'), 'request-1', arg),
      );
      hooks.deployment = state.deployments[PROJECT.path];
      props = {
        ...props,
        previousStep: 'publish-to-world',
        project: { ...PROJECT, worldConfiguration: { name: 'example.dcl.eth' } } as Project,
      };
      mount();
    });

    it('should show the error with a retry', () => {
      expect(screen.getByTestId('publish-modal-deploy-error')).toBeTruthy();
      expect(screen.getByTestId('publish-modal-deploy-error-retry')).toBeTruthy();
    });

    it('should not ask for a scene size limit', () => {
      expect(hooks.fetchWorldSceneSizeLimit).not.toHaveBeenCalled();
    });
  });
});
