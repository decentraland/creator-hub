import { useCallback, useEffect, useState } from 'react';

import { AssetPreview } from '../AssetPreview';
import { getDataLayerInterface, saveThumbnail } from '../../redux/data-layer';
import { useAppDispatch } from '../../redux/hooks';
import { transformBase64ResourceToBinary, withAssetDir } from '../../lib/data-layer/host/fs-utils';
import { getBaseName, getGltfResourceUris, getParentPath, joinPath } from './file-ops';

type Props = {
  /** Model paths (relative to `assets/`) that have no thumbnail yet, in priority order. */
  queue: string[];
  /** Called once per path once it has been processed, successfully or not. */
  onProcessed: (path: string, success: boolean) => void;
};

type Job = { path: string; file: File; resources: File[] };

/** Files a .gltf references by relative URI (buffers and images); a .glb is self contained. */
function getGltfResourcePaths(path: string, content: Uint8Array): string[] {
  if (!path.toLowerCase().endsWith('.gltf')) return [];
  return getGltfResourceUris(content).map(uri => joinPath(getParentPath(path), uri));
}

async function loadJob(path: string): Promise<Job> {
  const dataLayer = getDataLayerInterface();
  if (!dataLayer) throw new Error('Data layer is not available');
  const { content } = await dataLayer.getFile({ path: withAssetDir(path) });
  const resources: File[] = [];
  for (const resourcePath of getGltfResourcePaths(path, content)) {
    const resource = await dataLayer.getFile({ path: withAssetDir(resourcePath) });
    // the preview resolves relative URIs by the name used in the gltf
    const relativeName = resourcePath.slice(getParentPath(path).length).replace(/^\//, '');
    resources.push(new File([resource.content], relativeName));
  }
  return { path, file: new File([content], getBaseName(path)), resources };
}

/**
 * Generates thumbnails for 3D models that don't have one yet, one model at a time, in an
 * offscreen preview. It never blocks the UI: the explorer keeps showing a placeholder icon for
 * the tile until the saved thumbnail shows up in the thumbnails list.
 */
export function ThumbnailGenerator({ queue, onProcessed }: Props) {
  const dispatch = useAppDispatch();
  const [job, setJob] = useState<Job | null>(null);
  const current = queue[0];

  useEffect(() => {
    if (!current || job?.path === current) return;
    let cancelled = false;
    setJob(null);
    loadJob(current)
      .then(loaded => {
        if (!cancelled) setJob(loaded);
      })
      .catch(error => {
        console.warn(`Could not read ${current} to generate its thumbnail:`, error);
        if (!cancelled) onProcessed(current, false);
      });
    return () => {
      cancelled = true;
    };
  }, [current]);

  const handleScreenshot = useCallback(
    (path: string) => (screenshot?: string) => {
      if (screenshot) {
        dispatch(
          saveThumbnail({
            content: new Uint8Array(transformBase64ResourceToBinary(screenshot)),
            path,
          }),
        );
      }
      setJob(null);
      onProcessed(path, !!screenshot);
    },
    [dispatch, onProcessed],
  );

  if (!job || job.path !== current) return null;

  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        left: -10000,
        top: 0,
        width: 300,
        height: 300,
        pointerEvents: 'none',
      }}
    >
      <AssetPreview
        key={job.path}
        value={job.file}
        resources={job.resources}
        onScreenshot={handleScreenshot(job.path)}
      />
    </div>
  );
}
