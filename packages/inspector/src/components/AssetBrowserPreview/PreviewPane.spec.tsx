import { useEffect } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import PreviewPane from './PreviewPane';
import type * as PreviewSourceModule from './useAssetPreviewSource';

// The pane resets its details whenever the selection object changes, so the hooks must hand back
// the same objects on every render or the test loops.
const mocks = vi.hoisted(() => ({
  viewer: 'renders' as 'fails-on-mount' | 'throws-in-render' | 'renders',
  selection: {
    selection: {
      source: 'local',
      id: 'Models/tree.glb',
      name: 'tree.glb',
      path: 'Models/tree.glb',
    },
    select: vi.fn(),
  },
  source: {} as Record<string, unknown>,
}));

vi.mock('./selection', () => ({ useAssetSelection: () => mocks.selection }));
vi.mock('./useAssetPreviewSource', async importOriginal => ({
  ...(await importOriginal<typeof PreviewSourceModule>()),
  useAssetPreviewSource: () => mocks.source,
}));
vi.mock('./ModelViewer', () => ({
  ModelViewer: (props: { onFailed: () => void }) => {
    if (mocks.viewer === 'throws-in-render') throw new Error('unexpected viewer crash');
    // A viewer that cannot create its engine reports from its own mount effect.
    useEffect(() => {
      if (mocks.viewer === 'fails-on-mount') props.onFailed();
    }, []);
    return <canvas className="ModelViewer-canvas" />;
  },
}));
vi.mock('./EmoteViewer', () => ({ EmoteViewer: () => null }));

const modelSource = () => ({
  status: 'ready',
  source: {
    kind: 'model',
    name: 'tree.glb',
    extension: 'glb',
    url: 'blob:tree',
    thumbnail: 'data:image/png;base64,AAAA',
  },
});

describe('PreviewPane', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.viewer = 'renders';
    mocks.source = modelSource();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe('when the model viewer fails while mounting', () => {
    beforeEach(() => {
      mocks.viewer = 'fails-on-mount';
    });

    it('should fall back to the thumbnail instead of keeping the failed viewer', () => {
      const { container } = render(<PreviewPane />);
      expect(screen.getByText('3D preview unavailable, showing thumbnail')).not.toBeNull();
      expect(container.querySelector('.ModelViewer-canvas')).toBeNull();
    });
  });

  describe('when the model viewer throws while rendering', () => {
    beforeEach(() => {
      mocks.viewer = 'throws-in-render';
    });

    it('should show the preview as unavailable and keep the rest of the pane', () => {
      expect(() => render(<PreviewPane />)).not.toThrow();
      expect(screen.getByText('Preview unavailable')).not.toBeNull();
      expect(screen.getByText('tree.glb')).not.toBeNull();
    });
  });

  describe('when the browser cannot play an audio file', () => {
    beforeEach(() => {
      mocks.source = {
        status: 'ready',
        source: { kind: 'audio', name: 'odd.wav', extension: 'wav', url: 'blob:odd' },
      };
    });

    it('should replace the player with an unavailable message', () => {
      const { container } = render(<PreviewPane />);
      const audio = container.querySelector('audio');
      expect(audio).not.toBeNull();
      fireEvent.error(audio!);
      expect(container.querySelector('audio')).toBeNull();
      expect(screen.getByText('Preview unavailable')).not.toBeNull();
      expect(screen.getByText('The browser cannot play this file')).not.toBeNull();
    });
  });

  describe('when the browser cannot play a video file', () => {
    beforeEach(() => {
      mocks.source = {
        status: 'ready',
        source: { kind: 'video', name: 'odd.mp4', extension: 'mp4', url: 'blob:odd' },
      };
    });

    it('should replace the player with an unavailable message', () => {
      const { container } = render(<PreviewPane />);
      const video = container.querySelector('video');
      expect(video).not.toBeNull();
      fireEvent.error(video!);
      expect(container.querySelector('video')).toBeNull();
      expect(screen.getByText('Preview unavailable')).not.toBeNull();
    });
  });

  describe('when the browser cannot decode an image', () => {
    beforeEach(() => {
      mocks.source = {
        status: 'ready',
        source: { kind: 'image', name: 'odd.png', extension: 'png', url: 'blob:odd' },
      };
    });

    it('should replace the image with an unavailable message', () => {
      const { container } = render(<PreviewPane />);
      const img = container.querySelector('img');
      expect(img).not.toBeNull();
      fireEvent.error(img!);
      expect(container.querySelector('img')).toBeNull();
      expect(screen.getByText('The browser could not decode this image')).not.toBeNull();
    });
  });

  describe('when a file has no preview of its kind', () => {
    beforeEach(() => {
      mocks.source = {
        status: 'ready',
        source: { kind: 'other', name: 'notes.txt', extension: 'txt' },
      };
    });

    it('should say so instead of rendering a viewer', () => {
      render(<PreviewPane />);
      expect(screen.getByText('No preview for this file type')).not.toBeNull();
    });
  });
});
