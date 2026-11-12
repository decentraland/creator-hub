import { ipcRenderer, type IpcRendererEvent } from 'electron';

import {
  RECORDING_AUDIO_CHANNEL,
  RECORDING_EVENTS_CHANNEL,
  RECORDING_TOOLS_PROGRESS_EVENT,
  type RecordedEvent,
  type RecordingToolsStatus,
} from '/shared/types/recording';

import { invoke } from '../services/ipc';

export async function start(projectPath: string, projectTitle: string, language: string) {
  return invoke('recording.start', projectPath, projectTitle, language);
}

export async function stop(sessionId: string) {
  return invoke('recording.stop', sessionId);
}

export async function abort(sessionId: string) {
  return invoke('recording.abort', sessionId);
}

export async function toolsStatus(language: string) {
  return invoke('recording.toolsStatus', language);
}

export async function installTools(language: string) {
  return invoke('recording.installTools', language);
}

// Fire-and-forget: many small messages a second, kept out of the logged invoke path.
export function sendAudio(sessionId: string, pcm: Uint8Array, firstSampleAt?: number): void {
  ipcRenderer.send(RECORDING_AUDIO_CHANNEL, sessionId, pcm, firstSampleAt);
}

export function sendEvents(sessionId: string, events: RecordedEvent[]): void {
  ipcRenderer.send(RECORDING_EVENTS_CHANNEL, sessionId, events);
}

export function onToolsProgress(cb: (status: RecordingToolsStatus) => void): {
  cleanup: () => void;
} {
  const handler = (_: IpcRendererEvent, status: RecordingToolsStatus) => cb(status);
  ipcRenderer.on(RECORDING_TOOLS_PROGRESS_EVENT, handler);
  return { cleanup: () => ipcRenderer.off(RECORDING_TOOLS_PROGRESS_EVENT, handler) };
}
