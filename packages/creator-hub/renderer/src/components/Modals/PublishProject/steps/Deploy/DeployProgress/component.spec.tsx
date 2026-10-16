import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dark, ThemeProvider } from 'decentraland-ui2/dist/theme';

import type { DeployUpload } from '/@/lib/deploy';

import { DeployProgress } from './component';

vi.mock('/@/modules/store/translation/utils', async importOriginal => ({
  ...((await importOriginal()) as object),
  t: (id: string, values?: Record<string, unknown>) =>
    values ? `${id} ${JSON.stringify(values)}` : id,
}));

const MB = 1024 * 1024;

const renderProgress = (props: Partial<Parameters<typeof DeployProgress>[0]> = {}) =>
  render(
    <ThemeProvider theme={dark}>
      <DeployProgress
        canCancel={false}
        cancelling={false}
        onCancel={vi.fn()}
        {...props}
      />
    </ThemeProvider>,
  );

describe('DeployProgress', () => {
  let upload: DeployUpload;

  afterEach(cleanup);

  beforeEach(() => {
    upload = {
      stage: 'uploading',
      sentBytes: 5 * MB,
      totalBytes: 20 * MB,
      completedBatches: null,
      totalBatches: null,
    };
  });

  describe('when the files are being uploaded', () => {
    beforeEach(() => {
      renderProgress({ upload });
    });

    it('should fill the bar with the share of bytes sent', () => {
      expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('25');
    });

    it('should show the sent and total sizes', () => {
      expect(
        screen.getByText(
          'modal.publish_project.deploy.deploying.progress.uploading {"sent":"5.00 MB","total":"20.00 MB"}',
        ),
      ).toBeTruthy();
    });

    it('should not show a batch count', () => {
      expect(screen.queryByText(/progress\.batches/)).toBeNull();
    });
  });

  describe('when the upload is split in batches', () => {
    beforeEach(() => {
      renderProgress({ upload: { ...upload, completedBatches: 2, totalBatches: 5 } });
    });

    it('should show how many batches got uploaded', () => {
      expect(
        screen.getByText(
          'modal.publish_project.deploy.deploying.progress.batches {"completed":2,"total":5}',
        ),
      ).toBeTruthy();
    });
  });

  describe('when every byte is sent and the server is publishing', () => {
    beforeEach(() => {
      renderProgress({ upload: { ...upload, stage: 'processing', sentBytes: upload.totalBytes } });
    });

    it('should say the scene is being published', () => {
      expect(
        screen.getByText('modal.publish_project.deploy.deploying.progress.processing'),
      ).toBeTruthy();
    });

    it('should show an indeterminate bar', () => {
      expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBeNull();
    });
  });

  describe('when the deployment can be cancelled', () => {
    let onCancel: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      onCancel = vi.fn();
      renderProgress({ upload, canCancel: true, onCancel });
      fireEvent.click(
        screen.getByRole('button', {
          name: 'modal.publish_project.deploy.deploying.actions.cancel',
        }),
      );
    });

    it('should request the cancellation', () => {
      expect(onCancel).toHaveBeenCalledTimes(1);
    });
  });

  describe('when a cancellation is in flight', () => {
    beforeEach(() => {
      renderProgress({ upload, canCancel: true, cancelling: true });
    });

    it('should disable the cancel button', () => {
      expect(
        (
          screen.getByRole('button', {
            name: 'modal.publish_project.deploy.deploying.actions.cancelling',
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(true);
    });
  });

  describe('when the deployment can no longer be cancelled', () => {
    beforeEach(() => {
      renderProgress({ upload, canCancel: false });
    });

    it('should not offer to cancel', () => {
      expect(screen.queryByRole('button')).toBeNull();
    });
  });
});
