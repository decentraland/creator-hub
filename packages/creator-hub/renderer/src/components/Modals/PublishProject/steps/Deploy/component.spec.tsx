import type { ReactNode } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dark, ThemeProvider } from 'decentraland-ui2/dist/theme';

import type { Project } from '/shared/types/projects';
import type { Deployment } from '/@/modules/store/deployment/slice';
import type { Props } from '/@/components/Modals/PublishProject/types';

import { Deploy } from './component';

const hooks = vi.hoisted(() => ({
  deployment: undefined as Deployment | undefined,
  dispatch: vi.fn(),
}));

vi.mock('#store', () => ({
  useDispatch: () => hooks.dispatch,
  useSelector: () => [],
}));
vi.mock('/@/hooks/useAuth', () => ({ useAuth: () => ({ signOut: vi.fn(), wallet: '0xabc' }) }));
vi.mock('/@/hooks/useWorkspace', () => ({
  useWorkspace: () => ({ updateProjectInfo: vi.fn() }),
}));
vi.mock('/@/hooks/useEditor', () => ({
  useEditor: () => ({ loadingPublish: false, publishError: null }),
}));
vi.mock('/@/hooks/useDeploy', () => ({
  useDeploy: () => ({ getDeployment: () => hooks.deployment, executeDeployment: vi.fn() }),
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
  });

  const mount = () => {
    const ui = () => (
      <ThemeProvider theme={dark}>
        <Deploy {...props} />
      </ThemeProvider>
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
});
