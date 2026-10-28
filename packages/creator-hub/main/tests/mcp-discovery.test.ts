import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AI_EXTERNAL_ACCESS_CHANGED } from '/shared/types/ipc';

const mocks = vi.hoisted(() => ({
  userData: '',
  exposeMcpServer: false,
  externalAccess: false,
  serverDown: false,
  setSceneMcpProject: vi.fn(),
  setExternalMcpAccess: vi.fn(),
  writeConfig: vi.fn(),
  send: vi.fn(),
}));

vi.mock('electron', () => ({ app: { getVersion: () => '9.9.9-test' } }));
vi.mock('electron-log/main', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('../src/modules/electron', () => ({ getUserDataPath: () => mocks.userData }));
vi.mock('../src/mainWindow', () => ({ MAIN_WINDOW_ID: 'main' }));
vi.mock('../src/modules/window', () => ({
  getWindow: () => ({ isDestroyed: () => false, webContents: { send: mocks.send } }),
}));
vi.mock('../src/modules/config', () => ({
  getConfig: vi.fn(async () => ({ settings: { exposeMcpServer: mocks.exposeMcpServer } })),
  writeConfig: mocks.writeConfig,
}));
vi.mock('../src/modules/scene-mcp', () => ({
  setSceneMcpProject: mocks.setSceneMcpProject,
  setExternalMcpAccess: mocks.setExternalMcpAccess,
  getExternalMcpInfo: vi.fn(async () => {
    if (mocks.serverDown) throw new Error('port busy');
    return mocks.externalAccess ? MCP : null;
  }),
}));

import type * as McpDiscoveryModule from '../src/modules/mcp-discovery';
import {
  CLAUDE_MCP_CONFIG_FILE,
  MCP_DISCOVERY_FILE,
  accessRequestFilePath,
  discoveryFilePath,
  isTrackedByGit,
  removeClaudeMcpConfig,
  removeMcpDiscoveryFile,
  writeClaudeMcpConfig,
  writeMcpDiscoveryFile,
} from '../src/modules/mcp-discovery';

type McpDiscovery = typeof McpDiscoveryModule;

const MCP = { url: 'http://127.0.0.1:65000/mcp', token: 'secret-token-xyz' };

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ch-mcp-discovery-'));
  mocks.userData = path.join(dir, 'userData');
  fs.mkdirSync(mocks.userData);
  mocks.exposeMcpServer = false;
  mocks.externalAccess = false;
  mocks.serverDown = false;
  mocks.setSceneMcpProject.mockReset();
  mocks.setExternalMcpAccess.mockReset().mockImplementation((enabled: boolean) => {
    mocks.externalAccess = enabled;
  });
  mocks.writeConfig
    .mockReset()
    .mockImplementation(async (config: { settings: { exposeMcpServer: boolean } }) => {
      mocks.exposeMcpServer = config.settings.exposeMcpServer;
    });
  mocks.send.mockReset();
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

describe('isTrackedByGit', () => {
  describe('when the scene is a repo that tracks the file', () => {
    it('should say so', async () => {
      execFileSync('git', ['init', '-q'], { cwd: dir });
      fs.writeFileSync(path.join(dir, CLAUDE_MCP_CONFIG_FILE), '{}');
      execFileSync('git', ['add', CLAUDE_MCP_CONFIG_FILE], { cwd: dir });

      expect(await isTrackedByGit(dir, CLAUDE_MCP_CONFIG_FILE)).toBe(true);
    });
  });

  describe('when the scene is not a repo', () => {
    it('should say the file is not tracked', async () => {
      expect(await isTrackedByGit(dir, CLAUDE_MCP_CONFIG_FILE)).toBe(false);
    });
  });
});

describe('outside access to the MCP server', () => {
  let m: McpDiscovery;
  let scene: string;
  const projectFile = () => path.join(scene, CLAUDE_MCP_CONFIG_FILE);
  const readProjectFile = () => JSON.parse(fs.readFileSync(projectFile(), 'utf8'));
  const discoveryFile = () => discoveryFilePath(mocks.userData);

  beforeEach(async () => {
    // The module keeps the open scene and the scenes it wrote into; start each test clean.
    vi.resetModules();
    m = await import('../src/modules/mcp-discovery');
    scene = path.join(dir, 'scene');
    fs.mkdirSync(scene);
  });
  afterEach(() => {
    m.stopWatchingAccessRequests();
  });

  describe('when a scene is opened with access on', () => {
    it('should point the server at the scene and write both files with the outside token', async () => {
      mocks.exposeMcpServer = true;

      await m.initMcpDiscovery();
      await m.sceneOpened(scene);

      expect(mocks.setSceneMcpProject).toHaveBeenCalledWith(scene);
      expect(readProjectFile().mcpServers['creator-hub'].headers.Authorization).toBe(
        `Bearer ${MCP.token}`,
      );
      const discovery = JSON.parse(fs.readFileSync(discoveryFile(), 'utf8'));
      expect(discovery).toMatchObject({ ...MCP, pid: process.pid, version: '9.9.9-test' });
      expect(Date.parse(discovery.startedAt)).not.toBeNaN();
    });
  });

  describe('when a scene is opened with access off', () => {
    it('should still target the scene but grant nothing and write nothing', async () => {
      await m.initMcpDiscovery();
      await m.sceneOpened(scene);

      expect(mocks.setSceneMcpProject).toHaveBeenCalledWith(scene);
      expect(mocks.setExternalMcpAccess).not.toHaveBeenCalledWith(true);
      expect(fs.existsSync(projectFile())).toBe(false);
      expect(fs.existsSync(discoveryFile())).toBe(false);
    });

    it('should clean up an entry a crashed run left behind, keeping the user’s servers', async () => {
      fs.writeFileSync(
        projectFile(),
        JSON.stringify({ mcpServers: { 'creator-hub': {}, mine: { command: 'x' } } }),
      );

      await m.sceneOpened(scene);

      expect(readProjectFile().mcpServers).toEqual({ mine: { command: 'x' } });
    });
  });

  describe('when the scene’s repo tracks .mcp.json', () => {
    it('should leave the file alone and still write the discovery file', async () => {
      execFileSync('git', ['init', '-q'], { cwd: scene });
      fs.writeFileSync(projectFile(), '{"mcpServers":{}}\n');
      execFileSync('git', ['add', CLAUDE_MCP_CONFIG_FILE], { cwd: scene });
      mocks.exposeMcpServer = true;

      await m.initMcpDiscovery();
      await m.sceneOpened(scene);

      expect(fs.readFileSync(projectFile(), 'utf8')).toBe('{"mcpServers":{}}\n');
      expect(fs.existsSync(path.join(scene, '.gitignore'))).toBe(false);
      expect(fs.existsSync(discoveryFile())).toBe(true);
    });
  });

  describe('when the server fails to start', () => {
    it('should log and write nothing', async () => {
      mocks.exposeMcpServer = true;
      mocks.serverDown = true;

      await expect(m.initMcpDiscovery()).resolves.toBeUndefined();
      await m.sceneOpened(scene);

      expect(fs.existsSync(projectFile())).toBe(false);
      expect(fs.existsSync(discoveryFile())).toBe(false);
    });
  });

  describe('when access is turned on while a scene is open', () => {
    it('should grant it, write both files for that scene and tell the renderer', async () => {
      await m.sceneOpened(scene);

      await m.syncExposeMcpServer(true);

      expect(mocks.setExternalMcpAccess).toHaveBeenCalledWith(true);
      expect(mocks.send).toHaveBeenCalledWith(AI_EXTERNAL_ACCESS_CHANGED);
      expect(fs.existsSync(projectFile())).toBe(true);
      expect(fs.existsSync(discoveryFile())).toBe(true);
    });
  });

  describe('when access is turned off', () => {
    it('should revoke it, withdraw both files and tell the renderer', async () => {
      mocks.exposeMcpServer = true;
      await m.initMcpDiscovery();
      await m.sceneOpened(scene);

      await m.syncExposeMcpServer(false);

      expect(mocks.setExternalMcpAccess).toHaveBeenLastCalledWith(false);
      expect(mocks.send).toHaveBeenLastCalledWith(AI_EXTERNAL_ACCESS_CHANGED);
      expect(fs.existsSync(projectFile())).toBe(false);
      expect(fs.existsSync(discoveryFile())).toBe(false);
    });
  });

  describe('when the scene closes', () => {
    it('should detach the server and remove the scene’s entry', async () => {
      mocks.exposeMcpServer = true;
      await m.initMcpDiscovery();
      await m.sceneOpened(scene);

      m.sceneClosed(scene);

      expect(mocks.setSceneMcpProject).toHaveBeenLastCalledWith(null);
      expect(fs.existsSync(projectFile())).toBe(false);
      expect(fs.existsSync(discoveryFile())).toBe(true);
    });

    it('should not write into it when access is turned on later', async () => {
      await m.sceneOpened(scene);
      m.sceneClosed(scene);

      await m.syncExposeMcpServer(true);

      expect(fs.existsSync(projectFile())).toBe(false);
      expect(fs.existsSync(discoveryFile())).toBe(true);
    });
  });

  describe('when the app quits', () => {
    it('should withdraw the discovery file and the open scene’s entry', async () => {
      mocks.exposeMcpServer = true;
      await m.initMcpDiscovery();
      await m.sceneOpened(scene);

      m.clearMcpDiscovery();

      expect(fs.existsSync(discoveryFile())).toBe(false);
      expect(fs.existsSync(projectFile())).toBe(false);
    });
  });

  describe('when an agent asks for access', () => {
    const request = () => fs.writeFileSync(accessRequestFilePath(mocks.userData), '');

    describe('and access is off', () => {
      it('should turn the setting on, publish, consume the request and tell the creator once', async () => {
        await m.initMcpDiscovery();

        request();

        await vi.waitFor(() => expect(fs.existsSync(discoveryFile())).toBe(true));
        expect(mocks.exposeMcpServer).toBe(true);
        expect(fs.existsSync(accessRequestFilePath(mocks.userData))).toBe(false);
        expect(mocks.send).toHaveBeenCalledWith(AI_EXTERNAL_ACCESS_CHANGED);
        expect(m.takeExternalAccessGrant()).toBe(true);
        expect(m.takeExternalAccessGrant()).toBe(false);
      });

      it('should honour a request made while the Hub was closed', async () => {
        request();

        await m.initMcpDiscovery();

        await vi.waitFor(() => expect(fs.existsSync(discoveryFile())).toBe(true));
        expect(m.takeExternalAccessGrant()).toBe(true);
      });
    });

    describe('and access is already on', () => {
      it('should refresh the discovery file without a notice', async () => {
        mocks.exposeMcpServer = true;
        await m.initMcpDiscovery();
        removeMcpDiscoveryFile(discoveryFile());

        request();

        await vi.waitFor(() => expect(fs.existsSync(discoveryFile())).toBe(true));
        expect(mocks.writeConfig).not.toHaveBeenCalled();
        expect(m.takeExternalAccessGrant()).toBe(false);
      });
    });

    describe('and the creator turns access off before the notice is shown', () => {
      it('should drop the notice', async () => {
        request();
        await m.initMcpDiscovery();
        await vi.waitFor(() => expect(fs.existsSync(discoveryFile())).toBe(true));

        await m.syncExposeMcpServer(false);

        expect(m.takeExternalAccessGrant()).toBe(false);
      });
    });
  });
});
