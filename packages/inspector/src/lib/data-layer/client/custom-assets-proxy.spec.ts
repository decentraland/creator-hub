import { describe, it, expect, beforeEach, vi } from 'vitest';

import type { DataLayerRpcClient } from '../types';
import type { ParentCustomAssets } from './custom-assets-proxy';
import { withCustomAssetsFromParent } from './custom-assets-proxy';

/**
 * The proxy must route the custom-asset RPCs (and `custom/`-prefixed getFile) to the
 * parent host — where the shared Custom Items dir lives (#1554) — while everything
 * else (incl. `assets/custom/…` writes and non-custom getFile) stays on the WS realm.
 */
describe('withCustomAssetsFromParent', () => {
  const method = (label: string) => vi.fn(async () => label);
  let ws: Record<string, ReturnType<typeof method>>;
  let parent: Record<string, ReturnType<typeof method>>;
  let proxy: DataLayerRpcClient;

  beforeEach(() => {
    ws = {
      getCustomAssets: method('ws'),
      createCustomAsset: method('ws'),
      deleteCustomAsset: method('ws'),
      renameCustomAsset: method('ws'),
      getFile: method('ws'),
      importAsset: method('ws'),
      saveFile: method('ws'),
    };
    parent = {
      getCustomAssets: method('parent'),
      createCustomAsset: method('parent'),
      deleteCustomAsset: method('parent'),
      renameCustomAsset: method('parent'),
      getFile: method('parent'),
    };
    proxy = withCustomAssetsFromParent(
      ws as unknown as DataLayerRpcClient,
      parent as unknown as ParentCustomAssets,
    );
  });

  it.each(['getCustomAssets', 'createCustomAsset', 'deleteCustomAsset', 'renameCustomAsset'])(
    'routes %s to the parent host',
    async name => {
      await (proxy as unknown as Record<string, () => Promise<unknown>>)[name]();
      expect(parent[name]).toHaveBeenCalledTimes(1);
      expect(ws[name]).not.toHaveBeenCalled();
    },
  );

  it('routes custom/-prefixed getFile to the parent, other paths to the ws layer', async () => {
    await proxy.getFile({ path: 'custom/foo/model.glb' });
    await proxy.getFile({ path: 'custom' });
    expect(parent.getFile).toHaveBeenCalledTimes(2);

    await proxy.getFile({ path: 'assets/custom/foo/model.glb' });
    await proxy.getFile({ path: 'scene.json' });
    expect(ws.getFile).toHaveBeenCalledTimes(2);
  });

  it('leaves all other methods on the ws layer (e.g. importAsset, saveFile)', async () => {
    await (proxy as unknown as { importAsset: () => Promise<unknown> }).importAsset();
    await (proxy as unknown as { saveFile: () => Promise<unknown> }).saveFile();
    expect(ws.importAsset).toHaveBeenCalledTimes(1);
    expect(ws.saveFile).toHaveBeenCalledTimes(1);
  });

  it('binds parent methods to the parent (this is the parent host)', async () => {
    parent.getCustomAssets = vi.fn(async function (this: unknown) {
      return this === parent ? 'bound' : 'unbound';
    });
    proxy = withCustomAssetsFromParent(
      ws as unknown as DataLayerRpcClient,
      parent as unknown as ParentCustomAssets,
    );
    await expect(proxy.getCustomAssets({})).resolves.toBe('bound');
  });
});
