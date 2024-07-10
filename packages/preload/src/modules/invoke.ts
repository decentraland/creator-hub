import { ipcRenderer } from 'electron';
import type { Ipc } from '/shared/types/ipc';

// wrapper for ipcRenderer.invoke with types
export async function invoke<T extends keyof Ipc>(
  channel: T,
  ...args: Parameters<Ipc[T]>
): Promise<ReturnType<Ipc[T]>> {
  return ipcRenderer.invoke(channel, ...args);
}
