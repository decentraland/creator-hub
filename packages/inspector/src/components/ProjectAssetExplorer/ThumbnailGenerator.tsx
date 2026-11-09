import { useEffect, useRef, useState } from 'react';
import { Engine } from '@babylonjs/core/Engines/engine';
import '@babylonjs/loaders/glTF';

import { isEmoteContainer } from '../AssetPreview/emote';
import { createLocalResolver, loadModelContainer } from '../AssetBrowserPreview/gltfResolver';
import { createPreviewScene, frameCamera, isColliderMesh } from '../AssetBrowserPreview/modelScene';
import { getDataLayerInterface, saveThumbnail } from '../../redux/data-layer';
import { useAppDispatch } from '../../redux/hooks';
import { transformBase64ResourceToBinary, withAssetDir } from '../../lib/data-layer/host/fs-utils';

type Props = {
  /** Model paths (relative to `assets/`) that have no thumbnail yet, in priority order. */
  queue: string[];
  /** Called once per path once it has been processed, successfully or not. */
  onProcessed: (path: string, success: boolean) => void;
};

const SIZE = 300;

// A texture the data layer never answers for would otherwise hold the queue forever.
const JOB_TIMEOUT_MS = 20_000;

/** Renders models one at a time into a canvas and hands back each one as a PNG data URL. */
type ThumbnailRenderer = {
  render: (path: string) => Promise<string | undefined>;
  dispose: () => void;
};

type Job = {
  /** Set when the caller stopped waiting; the job must not touch the scene after that. */
  abandoned: boolean;
  /** Takes the job's model out of the shared scene, while it is in there. */
  detach?: () => void;
};

function extensionOf(path: string) {
  return path.split('.').pop()?.toLowerCase() ?? 'glb';
}

function detach(job: Job) {
  job.detach?.();
  job.detach = undefined;
}

function withTimeout<T>(work: Promise<T>, onTimeout: () => void): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      onTimeout();
      reject(new Error(`no thumbnail after ${JOB_TIMEOUT_MS}ms`));
    }, JOB_TIMEOUT_MS);
    work.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

/**
 * Thumbnails are drawn by the inspector's own Babylon engine, not by the remote wearable-preview
 * frame the import dialog uses. The frame has no file resolver of its own, so Babylon's glTF loader
 * rejects every texture URI that contains `..` as invalid (`GLTFLoader._ValidateUri`), and the
 * frame then never reports back; the optimizer writes exactly such URIs when it moves textures into a
 * shared folder (`../Images/<pack>/x.png`). The viewer's resolver answers those URIs before the
 * loader validates them, and a single long-lived engine also keeps the thumbnails off the browser's
 * WebGL context cap, which one short-lived preview frame per model kept pushing against.
 */
function createThumbnailRenderer(canvas: HTMLCanvasElement): ThumbnailRenderer {
  const engine = new Engine(canvas, true, {
    preserveDrawingBuffer: true,
    stencil: false,
    loseContextOnDispose: true,
  });
  const { scene, camera } = createPreviewScene(engine);
  let chain: Promise<unknown> = Promise.resolve();
  const running = new Set<Promise<unknown>>();
  let disposed = false;

  // A timed-out job keeps running in the background, and the next job may already own the scene by
  // the time it resumes: every await is followed by a staleness check before the scene is touched.
  const draw = async (path: string, job: Job): Promise<string | undefined> => {
    const isStale = () => job.abandoned || disposed;
    if (isStale()) return undefined;
    const dataLayer = getDataLayerInterface();
    if (!dataLayer) throw new Error('Data layer is not available');
    const { data } = await dataLayer.getAssetData({ path: withAssetDir(path) });
    if (isStale()) return undefined;
    const container = await loadModelContainer(
      scene,
      new Blob([data]),
      extensionOf(path),
      createLocalResolver(path),
    );
    try {
      if (isStale() || isEmoteContainer(container)) return undefined;
      container.meshes.filter(isColliderMesh).forEach(mesh => (mesh.isVisible = false));
      if (!container.meshes.some(mesh => mesh.isVisible && mesh.getTotalVertices() > 0)) {
        return undefined;
      }
      container.addAllToScene();
      job.detach = () => container.removeAllFromScene();
      container.animationGroups.forEach(group => group.stop());
      frameCamera(scene, camera);
      await scene.whenReadyAsync();
      if (isStale()) return undefined;
      scene.render();
      return canvas.toDataURL('image/png');
    } finally {
      detach(job);
      container.dispose();
    }
  };

  return {
    // Jobs share one scene, so they must never overlap: a job that is no longer wanted still runs
    // to completion before the next one starts. A timeout is the one exception: it takes the stuck
    // job's model out of the scene and marks the job abandoned, so it leaves the scene alone.
    render: path => {
      const job: Job = { abandoned: false };
      const result = chain.then(() => {
        const drawing = draw(path, job);
        running.add(drawing);
        void drawing.catch(() => {}).finally(() => running.delete(drawing));
        return withTimeout(drawing, () => {
          job.abandoned = true;
          detach(job);
        });
      });
      chain = result.catch(() => {});
      return result;
    },
    dispose: () => {
      disposed = true;
      void chain
        .then(() => Promise.allSettled(running))
        .finally(() => {
          scene.dispose();
          engine.dispose();
        });
    },
  };
}

/**
 * Generates thumbnails for 3D models that don't have one yet, one model at a time, in an
 * offscreen canvas. It never blocks the UI: the explorer keeps showing a placeholder icon for the
 * tile until the saved thumbnail shows up in the thumbnails list. A model that cannot be drawn is
 * reported as processed so the explorer stops waiting for it, and when no WebGL context can be
 * created at all every queued model is reported that way at once rather than one timeout at a time.
 */
export function ThumbnailGenerator({ queue, onProcessed }: Props) {
  const dispatch = useAppDispatch();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<ThumbnailRenderer | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const onProcessedRef = useRef(onProcessed);
  onProcessedRef.current = onProcessed;
  const current = queue[0];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      rendererRef.current = createThumbnailRenderer(canvas);
    } catch (error) {
      console.error('Model thumbnails cannot be generated in this session:', error);
      setUnavailable(true);
      return;
    }
    return () => {
      rendererRef.current?.dispose();
      rendererRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!current) return;
    if (unavailable) {
      onProcessedRef.current(current, false);
      return;
    }
    const renderer = rendererRef.current;
    if (!renderer) return;
    let cancelled = false;
    renderer.render(current).then(
      thumbnail => {
        // Saved even when the queue has moved on: the thumbnail is keyed by path and still valid.
        if (thumbnail) {
          dispatch(
            saveThumbnail({
              content: new Uint8Array(transformBase64ResourceToBinary(thumbnail)),
              path: current,
            }),
          );
        }
        if (cancelled) return;
        onProcessedRef.current(current, !!thumbnail);
      },
      error => {
        if (cancelled) return;
        console.warn(`Could not generate a thumbnail for ${current}:`, error);
        onProcessedRef.current(current, false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [current, unavailable, dispatch]);

  return (
    <canvas
      ref={canvasRef}
      width={SIZE}
      height={SIZE}
      aria-hidden
      style={{
        position: 'fixed',
        left: -10000,
        top: 0,
        width: SIZE,
        height: SIZE,
        pointerEvents: 'none',
      }}
    />
  );
}
