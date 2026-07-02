import { version } from '@dcl/asset-packs/package.json';

export type InspectorConfig = {
  dataLayerRpcWsUrl: string | null;
  dataLayerRpcParentUrl: string | null;
  binIndexJsUrl: string | null;
  disableSmartItems: boolean;
  contentUrl: string;
  segmentAppId: string | null;
  segmentUserId: string | null;
  segmentKey: string | null;
  projectId: string | null;
  catalystBaseUrl: string | null;
  /**
   * Realm the Bevy renderer loads its scene from — an HTTP URL to a running
   * content server (e.g. a headless `sdk-commands start --no-browser
   * --no-client`). The Bevy engine fetches /about + the scene bundle from here.
   * Null → the engine loads its default realm (renders no project scene).
   */
  bevyRealm: string | null;
  /** Parcel coords the Bevy engine spawns at, e.g. "0,0". */
  bevyPosition: string | null;
  /**
   * Realm URL of the super-user editor-agent scene loaded into the Bevy engine
   * as a portable experience (the engine's `?systemScene=` param). It does
   * viewport picking and posts results to the inspector over a BroadcastChannel.
   * Null → no agent, so no viewport-side selection (edits still work forward).
   */
  bevySystemScene: string | null;
};

export type GlobalWithConfig = typeof globalThis & {
  InspectorConfig?: Partial<InspectorConfig>;
};

export const CONTENT_URL = version.includes('commit')
  ? 'https://builder-items.decentraland.zone'
  : 'https://builder-items.decentraland.org';

export const CATALYST_BASE_URL = 'https://peer.decentraland.org';

export function getConfig(): InspectorConfig {
  const config = (globalThis as GlobalWithConfig).InspectorConfig;
  const params = new URLSearchParams(globalThis?.location?.search || '');
  return {
    dataLayerRpcWsUrl:
      params.get('ws') || params.get('dataLayerRpcWsUrl') || config?.dataLayerRpcWsUrl || null,
    dataLayerRpcParentUrl:
      params.get('parent') ||
      params.get('dataLayerRpcParentUrl') ||
      config?.dataLayerRpcParentUrl ||
      null,
    binIndexJsUrl: params.get('binIndexJsUrl') || config?.binIndexJsUrl || null,
    disableSmartItems: params.has('disableSmartItems') || !!config?.disableSmartItems,
    contentUrl: params.get('contentUrl') || config?.contentUrl || CONTENT_URL,
    segmentAppId: params.get('segmentAppId') || config?.segmentAppId || null,
    segmentUserId: params.get('segmentUserId') || config?.segmentUserId || null,
    segmentKey: params.get('segmentKey') || config?.segmentKey || null,
    projectId: params.get('projectId') || config?.projectId || null,
    catalystBaseUrl: params.get('catalystBaseUrl') || config?.catalystBaseUrl || CATALYST_BASE_URL,
    bevyRealm: params.get('bevyRealm') || config?.bevyRealm || null,
    bevyPosition: params.get('bevyPosition') || config?.bevyPosition || null,
    bevySystemScene: params.get('bevySystemScene') || config?.bevySystemScene || null,
  };
}
