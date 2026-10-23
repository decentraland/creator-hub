import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  userData: '',
  exposeMcpServer: true,
  startListeners: [] as Array<(info: { url: string; token: string }) => void>,
  ensureSceneMcpServer: vi.fn(),
  setSceneMcpProject: vi.fn(),
}));

vi.mock('electron', () => ({ app: { getVersion: () => '9.9.9-test' } }));
vi.mock('electron-log/main', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('../src/modules/electron', () => ({ getUserDataPath: () => mocks.userData }));
vi.mock('../src/modules/config', () => ({
  getConfig: vi.fn(async () => ({ settings: { exposeMcpServer: mocks.exposeMcpServer } })),
}));
vi.mock('../src/modules/scene-mcp', () => ({
  ensureSceneMcpServer: mocks.ensureSceneMcpServer,
  setSceneMcpProject: mocks.setSceneMcpProject,
  onSceneMcpStarted: (cb: (info: { url: string; token: string }) => void) => {
    mocks.startListeners.push(cb);
    return () => {};
  },
}));

import {
  CLAUDE_MCP_CONFIG_FILE,
  MCP_DISCOVERY_FILE,
  clearMcpDiscovery,
  discoveryFilePath,
  initMcpDiscovery,
  removeClaudeMcpConfig,
  removeMcpDiscoveryFile,
  sceneClosed,
  sceneOpened,
  syncExposeMcpServer,
  writeClaudeMcpConfig,
  writeMcpDiscoveryFile,
} from '../src/modules/mcp-discovery';

const MCP = { url: 'http://127.0.0.1:65000/mcp', token: 'secret-token-xyz' };

// Resolve pending microtasks (the orchestration chains a couple of awaits).
const settle = () => new Promise(resolve => setTimeout(resolve, 0));

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ch-mcp-discovery-'));
  mocks.userData = path.join(dir, 'userData');
  mocks.exposeMcpServer = true;
  mocks.startListeners.length = 0;
  mocks.ensureSceneMcpServer.mockReset().mockResolvedValue(MCP);
  mocks.setSceneMcpProject.mockReset();
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('writeClaudeMcpConfig', () => {
  const file = () => path.join(dir, CLAUDE_MCP_CONFIG_FILE);
  const read = () => JSON.parse(fs.readFileSync(file(), 'utf8'));

  describe('when the project has no .mcp.json yet', () => {
    it('should write the CH server as an http server with the bearer token', () => {
      writeClaudeMcpConfig(dir, MCP);

      expect(read().mcpServers['creator-hub']).toEqual({
        type: 'http',
        url: MCP.url,
        headers: { Authorization: `Bearer ${MCP.token}` },
      });
    });

    it('should create the file owner-only (0600)', () => {
      writeClaudeMcpConfig(dir, MCP);

      expect(fs.statSync(file()).mode & 0o777).toBe(0o600);
    });

    it('should gitignore the file, once, even across repeated writes', () => {
      writeClaudeMcpConfig(dir, MCP);
      writeClaudeMcpConfig(dir, MCP);

      const lines = fs
        .readFileSync(path.join(dir, '.gitignore'), 'utf8')
        .split(/\r?\n/)
        .filter(l => l.trim() === CLAUDE_MCP_CONFIG_FILE);
      expect(lines).toHaveLength(1);
    });
  });

  describe('when the project already has a .mcp.json with its own servers', () => {
    beforeEach(() => {
      fs.writeFileSync(
        file(),
        JSON.stringify({ mcpServers: { mine: { command: 'x' } }, other: 1 }),
      );
    });

    it('should add ours and keep the user’s servers and other keys', () => {
      writeClaudeMcpConfig(dir, MCP);

      const config = read();
      expect(config.mcpServers.mine).toEqual({ command: 'x' });
      expect(config.mcpServers['creator-hub'].url).toBe(MCP.url);
      expect(config.other).toBe(1);
    });
  });

  describe('when the .gitignore already covers the file', () => {
    it('should not append a second rule', () => {
      fs.writeFileSync(path.join(dir, '.gitignore'), `node_modules\n/${CLAUDE_MCP_CONFIG_FILE}\n`);

      writeClaudeMcpConfig(dir, MCP);

      expect(fs.readFileSync(path.join(dir, '.gitignore'), 'utf8')).toBe(
        `node_modules\n/${CLAUDE_MCP_CONFIG_FILE}\n`,
      );
    });
  });

  describe('when the .gitignore lacks a trailing newline', () => {
    it('should start the rule on its own line', () => {
      fs.writeFileSync(path.join(dir, '.gitignore'), 'node_modules');

      writeClaudeMcpConfig(dir, MCP);

      const lines = fs.readFileSync(path.join(dir, '.gitignore'), 'utf8').split('\n');
      expect(lines[0]).toBe('node_modules');
      expect(lines).toContain(CLAUDE_MCP_CONFIG_FILE);
    });
  });
});

describe('removeClaudeMcpConfig', () => {
  const file = () => path.join(dir, CLAUDE_MCP_CONFIG_FILE);

  describe('when ours is the only server', () => {
    it('should delete the file', () => {
      writeClaudeMcpConfig(dir, MCP);

      removeClaudeMcpConfig(dir);

      expect(fs.existsSync(file())).toBe(false);
    });
  });

  describe('when the user has servers of their own', () => {
    it('should drop only our entry', () => {
      fs.writeFileSync(file(), JSON.stringify({ mcpServers: { mine: { command: 'x' } } }));
      writeClaudeMcpConfig(dir, MCP);

      removeClaudeMcpConfig(dir);

      expect(JSON.parse(fs.readFileSync(file(), 'utf8'))).toEqual({
        mcpServers: { mine: { command: 'x' } },
      });
    });
  });

  describe('when the file carries other top-level keys', () => {
    it('should keep the file with an empty server map', () => {
      fs.writeFileSync(file(), JSON.stringify({ other: 1 }));
      writeClaudeMcpConfig(dir, MCP);

      removeClaudeMcpConfig(dir);

      expect(JSON.parse(fs.readFileSync(file(), 'utf8'))).toEqual({ other: 1, mcpServers: {} });
    });
  });

  describe('when there is no file or no entry of ours', () => {
    it('should do nothing', () => {
      expect(() => removeClaudeMcpConfig(dir)).not.toThrow();
      fs.writeFileSync(file(), JSON.stringify({ mcpServers: { mine: {} } }));

      removeClaudeMcpConfig(dir);

      expect(JSON.parse(fs.readFileSync(file(), 'utf8'))).toEqual({ mcpServers: { mine: {} } });
    });
  });
});

describe('the discovery file', () => {
  const info = { ...MCP, pid: 4242, startedAt: '2026-10-23T10:00:00.000Z', version: '1.2.3' };

  it('should live at <userData>/mcp-server.json', () => {
    expect(discoveryFilePath('/data')).toBe(path.join('/data', MCP_DISCOVERY_FILE));
    expect(discoveryFilePath()).toBe(path.join(mocks.userData, MCP_DISCOVERY_FILE));
  });

  describe('when written', () => {
    it('should hold url, token, pid, startedAt and version, owner-only', () => {
      const file = discoveryFilePath(mocks.userData);

      writeMcpDiscoveryFile(file, info);

      expect(JSON.parse(fs.readFileSync(file, 'utf8'))).toEqual(info);
      expect(fs.statSync(file).mode & 0o777).toBe(0o600);
      expect(fs.readdirSync(mocks.userData)).toEqual([MCP_DISCOVERY_FILE]); // no temp left
    });

    it('should overwrite a stale file from a previous run', () => {
      const file = discoveryFilePath(mocks.userData);
      writeMcpDiscoveryFile(file, { ...info, pid: 1, token: 'old' });

      writeMcpDiscoveryFile(file, info);

      expect(JSON.parse(fs.readFileSync(file, 'utf8')).token).toBe(MCP.token);
    });
  });

  describe('when removed', () => {
    it('should delete the file and tolerate it being absent', () => {
      const file = discoveryFilePath(mocks.userData);
      writeMcpDiscoveryFile(file, info);

      removeMcpDiscoveryFile(file);
      removeMcpDiscoveryFile(file);

      expect(fs.existsSync(file)).toBe(false);
    });
  });
});

describe('publishing for external agents', () => {
  const projectFile = () => path.join(dir, 'scene', CLAUDE_MCP_CONFIG_FILE);
  const discoveryFile = () => discoveryFilePath(mocks.userData);
  let scene: string;

  beforeEach(() => {
    scene = path.join(dir, 'scene');
    fs.mkdirSync(scene);
  });

  describe('when a scene is opened with the setting on', () => {
    it('should point the server at the scene, start it, and write both files', async () => {
      await sceneOpened(scene);

      expect(mocks.setSceneMcpProject).toHaveBeenCalledWith(scene);
      expect(mocks.ensureSceneMcpServer).toHaveBeenCalled();
      expect(JSON.parse(fs.readFileSync(projectFile(), 'utf8')).mcpServers['creator-hub'].url).toBe(
        MCP.url,
      );
      const discovery = JSON.parse(fs.readFileSync(discoveryFile(), 'utf8'));
      expect(discovery).toMatchObject({ ...MCP, pid: process.pid, version: '9.9.9-test' });
      expect(Date.parse(discovery.startedAt)).not.toBeNaN();
    });
  });

  describe('when a scene is opened with the setting off', () => {
    it('should still target the scene but write nothing and not start the server', async () => {
      mocks.exposeMcpServer = false;

      await sceneOpened(scene);

      expect(mocks.setSceneMcpProject).toHaveBeenCalledWith(scene);
      expect(mocks.ensureSceneMcpServer).not.toHaveBeenCalled();
      expect(fs.existsSync(projectFile())).toBe(false);
      expect(fs.existsSync(discoveryFile())).toBe(false);
    });
  });

  describe('when the server fails to start', () => {
    it('should log and write nothing', async () => {
      mocks.ensureSceneMcpServer.mockRejectedValue(new Error('port busy'));

      await expect(sceneOpened(scene)).resolves.toBeUndefined();

      expect(fs.existsSync(projectFile())).toBe(false);
      expect(fs.existsSync(discoveryFile())).toBe(false);
    });
  });

  describe('when the setting flips on while a scene is open', () => {
    it('should write both files for that scene', async () => {
      mocks.exposeMcpServer = false;
      await sceneOpened(scene);
      mocks.exposeMcpServer = true;

      await syncExposeMcpServer(true);

      expect(fs.existsSync(projectFile())).toBe(true);
      expect(fs.existsSync(discoveryFile())).toBe(true);
    });
  });

  describe('when the setting flips off while a scene is open', () => {
    it('should remove the discovery file and our entry from the scene', async () => {
      await sceneOpened(scene);

      await syncExposeMcpServer(false);

      expect(fs.existsSync(projectFile())).toBe(false);
      expect(fs.existsSync(discoveryFile())).toBe(false);
    });
  });

  describe('when the scene was closed before the setting flips', () => {
    it('should not write into the closed scene', async () => {
      mocks.exposeMcpServer = false;
      await sceneOpened(scene);
      sceneClosed(scene);
      mocks.exposeMcpServer = true;

      await syncExposeMcpServer(true);

      expect(fs.existsSync(projectFile())).toBe(false);
      expect(fs.existsSync(discoveryFile())).toBe(true);
    });
  });

  describe('when the server starts for another reason (an AI turn, the Settings tab)', () => {
    it('should write the discovery file while the setting is on', async () => {
      initMcpDiscovery();

      for (const cb of mocks.startListeners) cb(MCP);
      await settle();

      expect(JSON.parse(fs.readFileSync(discoveryFile(), 'utf8')).url).toBe(MCP.url);
    });

    it('should write nothing while the setting is off', async () => {
      mocks.exposeMcpServer = false;
      initMcpDiscovery();

      for (const cb of mocks.startListeners) cb(MCP);
      await settle();

      expect(fs.existsSync(discoveryFile())).toBe(false);
    });
  });

  describe('when the app quits', () => {
    it('should withdraw the discovery file', async () => {
      await sceneOpened(scene);

      clearMcpDiscovery();

      expect(fs.existsSync(discoveryFile())).toBe(false);
      expect(fs.existsSync(projectFile())).toBe(true); // rewritten with a fresh token next open
    });
  });
});
