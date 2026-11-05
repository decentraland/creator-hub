import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EmoteViewer } from './EmoteViewer';

const preview = vi.hoisted(() => ({
  props: null as { onLoad?: () => void; onError?: (error: Error) => void } | null,
}));

vi.mock('decentraland-ui', () => ({
  WearablePreview: Object.assign(
    (props: { onLoad?: () => void; onError?: (error: Error) => void }) => {
      preview.props = props;
      return <iframe />;
    },
    { createController: () => ({ emote: {} }) },
  ),
}));

describe('when the avatar preview never settles', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    preview.props = null;
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const renderViewer = () => render(<EmoteViewer file={new File([], 'dance.glb')} />);

  describe('and the frame reports an error', () => {
    it('should replace the spinner with an unavailable message', () => {
      const { container } = renderViewer();
      expect(container.querySelector('.PreviewPane-spinner')).not.toBeNull();
      act(() => preview.props?.onError?.(new Error('blocked')));
      expect(container.querySelector('.PreviewPane-spinner')).toBeNull();
      expect(screen.getByText('Avatar preview unavailable')).toBeTruthy();
    });
  });

  describe('and the frame reports nothing at all', () => {
    it('should give up after the deadline', () => {
      const { container } = renderViewer();
      act(() => vi.advanceTimersByTime(29_000));
      expect(container.querySelector('.PreviewPane-spinner')).not.toBeNull();
      act(() => vi.advanceTimersByTime(1_000));
      expect(container.querySelector('.PreviewPane-spinner')).toBeNull();
      expect(screen.getByText('Avatar preview unavailable')).toBeTruthy();
    });
  });
});
