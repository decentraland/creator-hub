import { afterEach, describe, expect, it } from 'vitest';

import { setStorage } from '../../../lib/data-layer/client/storage';
import type { Storage } from '../../../lib/logic/storage/types';
import {
  LEGACY_UI_FILE,
  regenerateAggregator,
  removeLegacySingleFile,
  restoreOrphanedUiImport,
  SCENE_ENTRY,
  UI_INDEX,
} from './store-core';

const STOCK_UI = `import ReactEcs, { ReactEcsRenderer, UiEntity } from '@dcl/sdk/react-ecs'

export function setupUi() {
  ReactEcsRenderer.setUiRenderer(uiMenu)
}

export const uiMenu = () => <UiEntity uiTransform={{ width: 300 }} />
`;

const ENTRY_WITH_IMPORT = `import { setupUi } from './ui'

setupUi()
`;

class MemStorage implements Storage {
  files = new Map<string, string>();

  constructor(seed: Record<string, string> = {}) {
    for (const [k, v] of Object.entries(seed)) this.files.set(k, v);
  }

  async readFile(path: string): Promise<Buffer> {
    const v = this.files.get(path);
    if (v === undefined) throw new Error(`ENOENT: ${path}`);
    return new TextEncoder().encode(v) as unknown as Buffer;
  }
  async writeFile(path: string, content: Buffer): Promise<void> {
    this.files.set(path, new TextDecoder().decode(content as unknown as Uint8Array));
  }
  async exists(path: string): Promise<boolean> {
    return this.files.has(path);
  }
  async delete(path: string): Promise<void> {
    this.files.delete(path);
  }
  async rmdir(): Promise<void> {}
  async list(): Promise<{ name: string; isDirectory: boolean }[]> {
    return [];
  }
  async stat(path: string): Promise<{ size: number }> {
    return { size: this.files.get(path)?.length ?? 0 };
  }
}

describe('code-mode legacy single-file handling', () => {
  afterEach(() => setStorage(undefined as unknown as Storage));

  describe('regenerateAggregator', () => {
    it('writes the aggregator before dropping the legacy file, never orphaning ./ui', async () => {
      const storage = new MemStorage({
        [SCENE_ENTRY]: ENTRY_WITH_IMPORT,
        [LEGACY_UI_FILE]: STOCK_UI,
      });
      setStorage(storage);

      await regenerateAggregator([]);

      expect(storage.files.has(UI_INDEX)).toBe(true);
      expect(storage.files.get(UI_INDEX)).toContain('export function setupUi()');
      expect(storage.files.has(LEGACY_UI_FILE)).toBe(false);
      expect(storage.files.get(`${LEGACY_UI_FILE}.bak`)).toBe(STOCK_UI);
    });
  });

  describe('removeLegacySingleFile', () => {
    it('is a no-op when there is no legacy file', async () => {
      const storage = new MemStorage({ [SCENE_ENTRY]: ENTRY_WITH_IMPORT });
      setStorage(storage);

      await removeLegacySingleFile();

      expect(storage.files.has(`${LEGACY_UI_FILE}.bak`)).toBe(false);
    });
  });

  describe('restoreOrphanedUiImport', () => {
    it('restores the legacy file from its backup when ./ui no longer resolves', async () => {
      const storage = new MemStorage({
        [SCENE_ENTRY]: ENTRY_WITH_IMPORT,
        [`${LEGACY_UI_FILE}.bak`]: STOCK_UI,
      });
      setStorage(storage);

      await restoreOrphanedUiImport();

      expect(storage.files.get(LEGACY_UI_FILE)).toBe(STOCK_UI);
    });

    it('writes an empty aggregator when there is no backup to restore', async () => {
      const storage = new MemStorage({ [SCENE_ENTRY]: ENTRY_WITH_IMPORT });
      setStorage(storage);

      await restoreOrphanedUiImport();

      expect(storage.files.get(UI_INDEX)).toContain('export function setupUi()');
    });

    it('does nothing when ./ui already resolves to the aggregator', async () => {
      const storage = new MemStorage({
        [SCENE_ENTRY]: ENTRY_WITH_IMPORT,
        [UI_INDEX]: 'export function setupUi() {}\n',
        [`${LEGACY_UI_FILE}.bak`]: STOCK_UI,
      });
      setStorage(storage);

      await restoreOrphanedUiImport();

      expect(storage.files.has(LEGACY_UI_FILE)).toBe(false);
    });

    it('does nothing when the scene entry does not import ./ui', async () => {
      const storage = new MemStorage({ [SCENE_ENTRY]: 'export const noUi = true\n' });
      setStorage(storage);

      await restoreOrphanedUiImport();

      expect(storage.files.has(LEGACY_UI_FILE)).toBe(false);
      expect(storage.files.has(UI_INDEX)).toBe(false);
    });
  });
});
