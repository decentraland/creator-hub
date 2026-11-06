import { fireEvent, render, screen } from '@testing-library/react';
import { flatten } from 'flat';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { captureException } from '@sentry/electron/renderer';
import { dark, ThemeProvider } from 'decentraland-ui2/dist/theme';

import type { Project } from '/shared/types/projects';
import { en } from '/@/modules/store/translation/locales';
import { setCurrentLocale } from '/@/modules/store/translation/utils';

import { PublishProject } from './component';

const crash = { enabled: true };

vi.mock('@sentry/electron/renderer', () => ({ captureException: vi.fn() }));
vi.mock('#store', () => ({ useDispatch: () => vi.fn() }));
vi.mock('/@/modules/store/ens', () => ({ fetchENSList: vi.fn() }));
// ui2's Modal reads theme breakpoints that don't resolve under happy-dom; the step specs
// stub it the same way.
vi.mock('./PublishModal', () => ({
  PublishModal: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div>{children}</div> : null,
}));
vi.mock('/@/hooks/useAuth', () => ({ useAuth: () => ({ wallet: undefined }) }));
vi.mock('./steps/Initial', () => ({
  Initial: () => {
    if (crash.enabled) {
      throw new Error('step failed');
    }
    return <p>Initial step</p>;
  },
}));

vi.mock('./steps/AlternativeServers', () => ({ AlternativeServers: () => null }));
vi.mock('./steps/PublishToWorld', () => ({ PublishToWorld: () => null }));
vi.mock('./steps/PublishToLand', () => ({ PublishToLand: () => null }));
vi.mock('./steps/Deploy', () => ({ Deploy: () => null }));

const project = { id: 'project-1', title: 'My Scene' } as Project;

function renderModal(onClose = vi.fn()) {
  const result = render(
    <ThemeProvider theme={dark}>
      <p>Editor behind the modal</p>
      <PublishProject
        open
        project={project}
        onClose={onClose}
      />
    </ThemeProvider>,
  );
  return { onClose, ...result };
}

describe('PublishProject error boundary', () => {
  beforeAll(() => {
    setCurrentLocale('en', flatten(en));
  });

  beforeEach(() => {
    crash.enabled = true;
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('when a step throws during render', () => {
    let onClose: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      ({ onClose } = renderModal());
    });

    it('should show the fallback inside the modal', () => {
      expect(screen.getByTestId('publish-error-fallback')).toBeTruthy();
    });

    it('should keep the page behind the modal mounted', () => {
      expect(screen.getByText('Editor behind the modal')).toBeTruthy();
    });

    it('should report the error to Sentry', () => {
      expect(captureException).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'step failed' }),
        expect.objectContaining({
          tags: { source: 'error-boundary', boundary: 'publish-modal' },
        }),
      );
    });

    describe('and the user clicks Close', () => {
      beforeEach(() => {
        fireEvent.click(screen.getByRole('button', { name: 'Close' }));
      });

      it('should close the modal', () => {
        expect(onClose).toHaveBeenCalled();
      });
    });

    describe('and the user clicks Try again once the cause is gone', () => {
      beforeEach(() => {
        crash.enabled = false;
        fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
      });

      it('should render the step again', () => {
        expect(screen.getByText('Initial step')).toBeTruthy();
        expect(screen.queryByTestId('publish-error-fallback')).toBeNull();
      });
    });
  });

  describe('when the modal is reopened after an error', () => {
    it('should start from the step instead of the fallback', () => {
      const onClose = vi.fn();
      const { rerender } = renderModal(onClose);
      expect(screen.getByTestId('publish-error-fallback')).toBeTruthy();

      crash.enabled = false;
      const modal = (open: boolean) => (
        <ThemeProvider theme={dark}>
          <p>Editor behind the modal</p>
          <PublishProject
            open={open}
            project={project}
            onClose={onClose}
          />
        </ThemeProvider>
      );
      rerender(modal(false));
      rerender(modal(true));

      expect(screen.getByText('Initial step')).toBeTruthy();
    });
  });
});
