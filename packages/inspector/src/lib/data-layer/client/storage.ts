import type { Storage } from '../../logic/storage/types';

// The scene's file storage, published by whichever data-layer client this
// session runs on (the Creator Hub iframe bridge, or the local in-memory
// fixture). Code-mode reads and writes the scene's src/ui/*.tsx through it,
// bypassing the ECS data layer.
let instance: Storage | undefined;

export function setStorage(storage: Storage): void {
  instance = storage;
}

export function getStorage(): Storage | undefined {
  return instance;
}
