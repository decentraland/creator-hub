import { RENDERER } from '/shared/types/settings';

import type { Project } from '/shared/types/projects';

export type InspectorUrlInput = {
  inspectorPort: number;
  useBevy: boolean;
  supportsUiDesigner: boolean;
  bevyRealm: { url: string; wsUrl: string } | null;
  project: Project | undefined;
  userId: string | null;
};

/** Builds the inspector iframe URL, including every host-supplied config query param. */
export function buildInspectorUrl({
  inspectorPort,
  useBevy,
  supportsUiDesigner,
  bevyRealm,
  project,
  userId,
}: InspectorUrlInput): string {
  const htmlUrl = `http://localhost:${import.meta.env.VITE_INSPECTOR_PORT || inspectorPort}`;
  let binIndexJsUrl = `${htmlUrl}/bin/index.js`;

  const params = new URLSearchParams();

  params.append('renderer', useBevy ? RENDERER.BEVY : RENDERER.BABYLON);

  params.append('uiEditorEnabled', 'true');
  params.append('uiEditorSupported', String(supportsUiDesigner));

  params.append('dataLayerRpcParentUrl', window.location.origin);

  if (useBevy && bevyRealm) {
    params.append('dataLayerRpcWsUrl', bevyRealm.wsUrl);
    params.append('bevyRealm', bevyRealm.url);
    if (project) {
      params.append('bevyPosition', project.scene.base);
    }
    params.append(
      'bevySystemScene',
      import.meta.env.VITE_BEVY_SYSTEM_SCENE || `${htmlUrl}/bevy-agent/bevy-agent`,
    );
  }

  if (import.meta.env.VITE_ASSET_PACKS_CONTENT_URL) {
    params.append('contentUrl', import.meta.env.VITE_ASSET_PACKS_CONTENT_URL);
  }

  if (import.meta.env.VITE_ASSET_PACKS_JS_PORT && import.meta.env.VITE_ASSET_PACKS_JS_PATH) {
    const b64 = btoa(import.meta.env.VITE_ASSET_PACKS_JS_PATH);
    binIndexJsUrl = `http://localhost:${import.meta.env.VITE_ASSET_PACKS_JS_PORT}/content/contents/b64-${b64}`;
  }

  params.append('binIndexJsUrl', binIndexJsUrl);

  if (import.meta.env.VITE_SEGMENT_INSPECTOR_API_KEY) {
    params.append('segmentKey', import.meta.env.VITE_SEGMENT_INSPECTOR_API_KEY);
  }

  params.append('segmentAppId', 'creator-hub');
  if (userId) {
    params.append('segmentUserId', userId);
  }
  if (project) {
    params.append('projectId', project.id);
    params.append('uiDesignerOpen', String(project.info.uiDesignerOpen ?? false));
  }

  return `${htmlUrl}?${params}`;
}
