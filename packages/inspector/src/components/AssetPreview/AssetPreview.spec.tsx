import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AssetPreview } from './AssetPreview';

const preview = vi.hoisted(() => ({
  props: null as { onLoad?: () => void; onError?: (error: Error) => void } | null,
  getScreenshot: vi.fn(),
}));

vi.mock('decentraland-ui', () => ({
  WearablePreview: Object.assign(
    (props: { onLoad?: () => void; onError?: (error: Error) => void }) => {
      preview.props = props;
      return null;
    },
    { createController: () => ({ scene: { getScreenshot: preview.getScreenshot } }) },
  ),
}));

describe('AssetPreview', () => {
  let onScreenshot: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    preview.props = null;
    preview.getScreenshot.mockReset();
    onScreenshot = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const renderModel = () =>
    render(
      <AssetPreview
        value={new File([], 'model.glb')}
        onScreenshot={onScreenshot}
      />,
    );

  describe('when the preview renders the model and returns a screenshot', () => {
    it('should report the thumbnail it captured', async () => {
      preview.getScreenshot.mockResolvedValue('data:image/png;base64,thumbnail');
      renderModel();

      await act(async () => {
        preview.props!.onLoad!();
        await vi.advanceTimersByTimeAsync(1000);
      });

      expect(onScreenshot).toHaveBeenCalledTimes(1);
      expect(onScreenshot).toHaveBeenCalledWith('data:image/png;base64,thumbnail');
    });
  });

  describe('when the preview reports it could not render the model', () => {
    it('should report no thumbnail so the import can go ahead without one', async () => {
      renderModel();

      await act(async () => {
        preview.props!.onError!(new Error('could not load model'));
      });

      expect(onScreenshot).toHaveBeenCalledTimes(1);
      expect(onScreenshot).toHaveBeenCalledWith(undefined);
    });
  });

  describe('when taking the screenshot fails', () => {
    it('should report no thumbnail rather than leave the promise unhandled', async () => {
      preview.getScreenshot.mockRejectedValue(new Error('no renderer'));
      renderModel();

      await act(async () => {
        preview.props!.onLoad!();
      });

      expect(onScreenshot).toHaveBeenCalledTimes(1);
      expect(onScreenshot).toHaveBeenCalledWith(undefined);
    });
  });

  describe('when the preview never responds, as a frame the browser refused to load (#1485)', () => {
    it('should report no thumbnail once it gives up, since nothing else can end the wait', async () => {
      renderModel();

      expect(onScreenshot).not.toHaveBeenCalled();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_000);
      });

      expect(onScreenshot).toHaveBeenCalledTimes(1);
      expect(onScreenshot).toHaveBeenCalledWith(undefined);
      expect(console.error).toHaveBeenCalled();
    });
  });
});
