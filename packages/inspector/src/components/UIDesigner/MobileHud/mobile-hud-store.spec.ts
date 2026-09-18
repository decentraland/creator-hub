import { parseSync } from 'oxc-parser';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { setStorage } from '../../../lib/data-layer/client/storage';
import type { Storage } from '../../../lib/logic/storage/types';
import { defaultMobileHudConfig } from './mobile-hud-config';
import { MOBILE_HUD_MODULE } from './mobile-hud-emit';
import { loadMobileHudConfig, writeMobileHudConfig } from './mobile-hud-store';

vi.mock('../../../lib/logic/code-parser', () => ({
  getCodeParser: () => ({
    parse: async (filename: string, source: string) => {
      const result = parseSync(filename, source);
      return { program: result.program, comments: [], errors: result.errors };
    },
  }),
}));

const SCENE_ENTRY_SRC =
  "import { setupUi } from './ui'\n\nexport function main() {\n  setupUi()\n}\n";

function memStorage(files: Record<string, string>): Storage {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  return {
    readFile: async path => {
      if (!(path in files)) throw new Error(`no such file: ${path}`);
      return Buffer.from(encoder.encode(files[path]));
    },
    writeFile: async (path, content) => {
      files[path] = decoder.decode(content as unknown as Uint8Array);
    },
    exists: async path => path in files,
    delete: async path => {
      delete files[path];
    },
    rmdir: async () => {},
    list: async () => [],
    stat: async path => ({ size: files[path]?.length ?? 0 }),
  };
}

describe('when persisting a MobileHUD config', () => {
  let files: Record<string, string>;

  beforeEach(() => {
    files = { 'src/index.ts': SCENE_ENTRY_SRC };
    setStorage(memStorage(files));
  });

  it('should write the module and wire the scene entry on a non-default change', async () => {
    const config = defaultMobileHudConfig();
    config.hideJoystick = true;
    await writeMobileHudConfig(config);

    expect(files[MOBILE_HUD_MODULE]).toContain('hideJoystick: true');
    expect(files['src/index.ts']).toContain("import { setupMobileHud } from './mobile-hud'");
    expect(files['src/index.ts']).toContain('setupMobileHud()');
  });

  it('should read the written config back from disk', async () => {
    const config = defaultMobileHudConfig();
    config.mainAction = 'IA_PRIMARY';
    config.buttons.IA_POINTER.hide = true;
    await writeMobileHudConfig(config);

    await expect(loadMobileHudConfig()).resolves.toEqual(config);
  });

  it('should delete the module and unwire the entry when reset to defaults', async () => {
    const config = defaultMobileHudConfig();
    config.hideJoystick = true;
    await writeMobileHudConfig(config);

    await writeMobileHudConfig(defaultMobileHudConfig());

    expect(MOBILE_HUD_MODULE in files).toBe(false);
    expect(files['src/index.ts']).not.toContain('mobile-hud');
    expect(files['src/index.ts']).toBe(SCENE_ENTRY_SRC);
  });
});
