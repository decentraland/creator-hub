import { createIframeStorage } from '../../logic/storage';
import type { Storage } from '../../logic/storage/types';
import { createIframeCodeParser } from '../../logic/code-parser';
import { setStorage } from './storage';

/**
 * Open the inspector's ends of the two parent-window channels code mode depends
 * on: the scene's file storage and the native code parser.
 *
 * These ride `dataLayerRpcParentUrl`, NOT the data layer — code mode reads and
 * writes `src/ui/*.tsx` straight through storage, bypassing the ECS layer
 * entirely (see ./storage.ts). So they must be wired for every transport that
 * has a parent bridge, including the WebSocket one the Bevy renderer takes
 * (which uses the realm's data layer so entity ids line up with the engine, but
 * still gets `dataLayerRpcParentUrl` from the host). Wiring them only in
 * createIframeDataLayerRpcClient is what left the UI Designer inert under Bevy:
 * every read returned '' and every write was dropped.
 *
 * Creator Hub's initRpc publishes both channels unconditionally for either
 * renderer, over its one AuthenticatedMessageTransport — this only opens the
 * client ends, so the shared-transport invariant is untouched.
 */
export function wireParentBridges(origin: string): Storage {
  const storage = createIframeStorage(origin);
  setStorage(storage);
  // Native oxc-parser lives in CH main; standalone dev builds fall back to a
  // wasm parser in the tab instead (see logic/code-parser).
  createIframeCodeParser(origin);
  return storage;
}
