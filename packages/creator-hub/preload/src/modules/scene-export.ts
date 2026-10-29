import { ipcRenderer, type IpcRendererEvent } from 'electron';

import { SCENE_EXPORT_PROGRESS_EVENT, type SceneExportProgress } from '/shared/types/scene-export';

import { invoke } from '../services/ipc';

export async function exportScene(entityId: string, title: string) {
  return invoke('sceneExport.export', entityId, title);
}

export async function cancel(entityId: string) {
  return invoke('sceneExport.cancel', entityId);
}

export function subscribeProgress(
  entityId: string,
  cb: (progress: SceneExportProgress) => void,
): { cleanup: () => void } {
  const handler = (_: IpcRendererEvent, payload: SceneExportProgress) => {
    if (payload.entityId === entityId) cb(payload);
  };
  ipcRenderer.on(SCENE_EXPORT_PROGRESS_EVENT, handler);
  return { cleanup: () => ipcRenderer.off(SCENE_EXPORT_PROGRESS_EVENT, handler) };
}
