import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AssetPreview } from './AssetPreview';

const preview = vi.hoisted(() => ({
  props: null as { onLoad?: () => void; onError?: (error: Error) => void } | null,
  getScreenshot: vi.fn(),
  getMetrics: vi.fn(),
}));

vi.mock('decentraland-ui', () => ({
  WearablePreview: Object.assign(
    (props: { onLoad?: () => void; onError?: (error: Error) => void }) => {
      preview.props = props;
      return <iframe />;
    },
    {
      createController: () => ({
        scene: { getScreenshot: preview.getScreenshot, getMetrics: preview.getMetrics },
      }),
    },
  ),
}));

describe('AssetPreview', () => {
  let onScreenshot: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    preview.props = null;
    preview.getScreenshot.mockReset();
    preview.getMetrics.mockReset().mockResolvedValue({ triangles: 12 });
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

  /** The preview frame announcing it is ready, which is when the model is sent to it. */
  const frameReady = (container: HTMLElement) => {
    const frame = container.querySelector('iframe')!.contentWindow!;
    const postMessage = vi.spyOn(frame, 'postMessage');
    window.dispatchEvent(new MessageEvent('message', { data: { type: 'ready' }, source: frame }));
    return postMessage;
  };

  describe('when the preview renders the model and returns a screenshot', () => {
    it('should report the thumbnail it captured', async () => {
      preview.getScreenshot.mockResolvedValue('data:image/png;base64,thumbnail');
      const { container } = renderModel();
      frameReady(container);

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
      const { container } = renderModel();
      frameReady(container);

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

  describe('when the frame is ready', () => {
    it('should send it the model, which the preview component drops when it arrives early', () => {
      const { container } = renderModel();

      const postMessage = frameReady(container);

      expect(postMessage).toHaveBeenCalledWith(
        {
          type: 'update',
          payload: { options: { blob: expect.objectContaining({ id: 'model.glb' }) } },
        },
        '*',
      );
    });
  });

  describe('when the frame loads before the model has been sent', () => {
    it('should not screenshot that empty scene', async () => {
      preview.getScreenshot.mockResolvedValue('data:image/png;base64,empty');
      renderModel();

      await act(async () => {
        preview.props!.onLoad!();
        await vi.advanceTimersByTimeAsync(1000);
      });

      expect(preview.getScreenshot).not.toHaveBeenCalled();
      expect(onScreenshot).not.toHaveBeenCalled();
    });
  });

  describe('when a newer render replaces the scene being screenshotted', () => {
    it('should wait for the next load and report its thumbnail', async () => {
      preview.getScreenshot
        .mockRejectedValueOnce(new Error('The scene was disposed, a newer render has replaced it'))
        .mockResolvedValueOnce('data:image/png;base64,model');
      const { container } = renderModel();
      frameReady(container);

      await act(async () => {
        preview.props!.onLoad!();
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(onScreenshot).not.toHaveBeenCalled();

      await act(async () => {
        preview.props!.onLoad!();
        await vi.advanceTimersByTimeAsync(1000);
      });

      expect(onScreenshot).toHaveBeenCalledTimes(1);
      expect(onScreenshot).toHaveBeenCalledWith('data:image/png;base64,model');
    });
  });

  describe('when the frame reports its empty scene loaded before the model', () => {
    it('should skip that render and screenshot the model once it loads', async () => {
      preview.getMetrics
        .mockResolvedValueOnce({ triangles: 0 })
        .mockResolvedValueOnce({ triangles: 12 });
      preview.getScreenshot.mockResolvedValue('data:image/png;base64,model');
      const { container } = renderModel();
      frameReady(container);

      await act(async () => {
        preview.props!.onLoad!();
        await vi.advanceTimersByTimeAsync(1000);
      });
      expect(preview.getScreenshot).not.toHaveBeenCalled();

      await act(async () => {
        preview.props!.onLoad!();
        await vi.advanceTimersByTimeAsync(1000);
      });

      expect(onScreenshot).toHaveBeenCalledTimes(1);
      expect(onScreenshot).toHaveBeenCalledWith('data:image/png;base64,model');
    });
  });
});
