import type { DataLayerRpcClient } from '../types';
import type { GetFileRequest } from '../proto/gen/data-layer.gen';

/**
 * Custom items live in a shared, per-user directory (`<userData>/Custom Items`),
 * NOT inside the project. Creator Hub's parent data-layer redirects the inspector's
 * `custom/…` paths to that directory; the Bevy realm's sdk-commands data-layer does
 * not — it resolves `custom/…` against the project root, where the files don't
 * exist. So under Bevy the Custom Items panel comes back empty and dropping one
 * fails (#1554).
 *
 * This routes the custom-asset RPCs (and `custom/`-prefixed `getFile` reads) to a
 * parent data-layer host — which carries the shared-dir redirect — while everything
 * else (scene CRDT, project files, and `importAsset` writes into `assets/custom/…`)
 * stays on the realm's WS data-layer, so the dropped GLB is still copied into the
 * project and served to the engine as before.
 *
 * Note: `createCustomAsset` then records its undo on the parent host's stack rather
 * than the scene's — acceptable, since a custom asset lives in the shared library,
 * not the scene.
 */
const CUSTOM_ASSET_METHODS = [
  'getCustomAssets',
  'createCustomAsset',
  'deleteCustomAsset',
  'renameCustomAsset',
] as const;

/**
 * The only slice of the data layer the parent host serves here: the custom-asset
 * RPCs plus `getFile` (for `custom/`-prefixed reads). Narrowing to this (instead of
 * the full client) makes the `parentHost.rpcMethods` cast in connect.ts fail at
 * compile time if any of these methods ever stops being implemented.
 */
export type ParentCustomAssets = Pick<
  DataLayerRpcClient,
  (typeof CUSTOM_ASSET_METHODS)[number] | 'getFile'
>;

const CUSTOM_ASSET_METHOD_SET = new Set<PropertyKey>(CUSTOM_ASSET_METHODS);

const isCustomPath = (path: string | undefined): boolean =>
  path === 'custom' || (path?.startsWith('custom/') ?? false);

export function withCustomAssetsFromParent(
  ws: DataLayerRpcClient,
  parent: ParentCustomAssets,
): DataLayerRpcClient {
  return new Proxy(ws, {
    get(target, prop, receiver) {
      if (CUSTOM_ASSET_METHOD_SET.has(prop)) {
        const fn = Reflect.get(parent, prop) as unknown;
        return typeof fn === 'function' ? fn.bind(parent) : fn;
      }
      if (prop === 'getFile') {
        return (req: GetFileRequest) =>
          isCustomPath(req.path) ? parent.getFile(req) : target.getFile(req);
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}
