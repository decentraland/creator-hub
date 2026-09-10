import type { Storage } from '../../logic/storage/types';

let instance: Storage | undefined;

export function setStorage(storage: Storage): void {
  instance = storage;
}

export function getStorage(): Storage | undefined {
  return instance;
}
