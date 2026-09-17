import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { EditorConfig } from '/shared/types/config';

import { open } from '../src/modules/code';

// `vi.hoisted` is required here: code.ts imports `child_process` and `electron` at its
// top, so the factories below run before plain module-level consts are initialized.
const { execFileSpy, execSpy, openPathSpy, showItemInFolderSpy } = vi.hoisted(() => {
  const succeed = (...args: unknown[]) => {
    const cb = args[args.length - 1] as (err: unknown, res: unknown) => void;
    cb(null, { stdout: '', stderr: '' });
  };
  return {
    execFileSpy: vi.fn(succeed),
    execSpy: vi.fn(succeed),
    openPathSpy: vi.fn(),
    showItemInFolderSpy: vi.fn(),
  };
});

vi.mock('child_process', () => ({ exec: execSpy, execFile: execFileSpy }));

vi.mock('electron', () => ({
  shell: {
    openPath: openPathSpy,
    showItemInFolder: showItemInFolderSpy,
    openExternal: vi.fn(),
  },
}));

vi.mock('electron-log/main', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../src/modules/analytics', () => ({ track: vi.fn() }));

let editors: EditorConfig[] = [];

const configStorage = {
  get: vi.fn(async () => editors),
  set: vi.fn(async (_key: string, value: typeof editors) => {
    editors = value;
  }),
};

vi.mock('../src/modules/config', () => ({
  getConfigStorage: vi.fn(async () => configStorage),
}));

vi.mock('fs/promises', () => ({
  default: {
    stat: vi.fn(async () => ({ isDirectory: () => true })),
    readdir: vi.fn(async () => []),
  },
}));

const EDITOR_PATH = '/Applications/Visual Studio Code.app/Contents/MacOS/Electron';

describe('code.open', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    editors = [{ name: 'VSCode', path: EDITOR_PATH, isDefault: true }];
  });

  describe('when the path contains shell metacharacters', () => {
    const pathWithShellCharacters = '/projects/scene/a$(x)b`y`;z&w|v';

    it('should pass the whole path as a single argv element', async () => {
      await open(pathWithShellCharacters);

      expect(execFileSpy).toHaveBeenCalledTimes(1);
      const [file, args] = execFileSpy.mock.calls[0];
      expect(file).toBe(EDITOR_PATH);
      expect(args).toEqual([pathWithShellCharacters]);
    });

    it('should not build a shell command string', async () => {
      await open(pathWithShellCharacters);

      expect(execSpy).not.toHaveBeenCalled();
      for (const call of execFileSpy.mock.calls) {
        expect(typeof call[0]).toBe('string');
        expect(call[0]).not.toContain('$(');
        expect(call[0]).not.toContain(pathWithShellCharacters);
      }
    });
  });

  describe('when the editor launches successfully', () => {
    it('should not also reveal the path in the file manager', async () => {
      await open('/projects/scene/main.ts');

      expect(execFileSpy).toHaveBeenCalledTimes(1);
      expect(showItemInFolderSpy).not.toHaveBeenCalled();
      expect(openPathSpy).not.toHaveBeenCalled();
    });
  });

  describe('when reading the editor list fails', () => {
    beforeEach(() => {
      configStorage.get.mockRejectedValueOnce(new Error('config unreadable'));
    });

    it('should reveal the path instead of rejecting', async () => {
      await expect(open('/projects/scene/main.ts')).resolves.toBeUndefined();

      expect(showItemInFolderSpy).toHaveBeenCalledWith('/projects/scene/main.ts');
    });
  });

  describe('when the editor process fails', () => {
    beforeEach(() => {
      execFileSpy.mockImplementationOnce((...args: unknown[]) => {
        const cb = args[args.length - 1] as (err: unknown) => void;
        cb(new Error('spawn failed'));
      });
    });

    it('should reveal the path in the file manager', async () => {
      await open('/projects/scene/main.ts');

      expect(showItemInFolderSpy).toHaveBeenCalledWith('/projects/scene/main.ts');
    });

    it('should not hand the path to the OS default handler', async () => {
      await open('/projects/scene/main.ts');

      expect(openPathSpy).not.toHaveBeenCalled();
    });
  });

  describe('when no editor is configured as default', () => {
    beforeEach(() => {
      editors = [{ name: 'VSCode', path: EDITOR_PATH, isDefault: false }];
    });

    it('should reveal the path without launching a process', async () => {
      await open('/projects/scene/main.ts');

      expect(execFileSpy).not.toHaveBeenCalled();
      expect(showItemInFolderSpy).toHaveBeenCalledWith('/projects/scene/main.ts');
    });

    it('should not hand the path to the OS default handler', async () => {
      await open('/projects/scene/main.ts');

      expect(openPathSpy).not.toHaveBeenCalled();
    });
  });

  describe('when the path is a file type the OS runs on open', () => {
    const batFilePath = '/projects/scene/build.bat';

    it('should never reach the OS handler, with or without an editor', async () => {
      await open(batFilePath);

      editors = [{ name: 'VSCode', path: EDITOR_PATH, isDefault: false }];
      await open(batFilePath);

      expect(openPathSpy).not.toHaveBeenCalled();
    });
  });
});
