import { createIframeStorage } from '../../logic/storage';
import type { Storage } from '../../logic/storage/types';
import { createIframeCodeParser } from '../../logic/code-parser';
import { setStorage } from './storage';

/** Open the inspector's client ends of the parent-window storage and code-parser channels. */
export function wireParentBridges(origin: string): Storage {
  const storage = createIframeStorage(origin);
  setStorage(storage);
  createIframeCodeParser(origin);
  return storage;
}
